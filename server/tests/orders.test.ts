import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// The real PDF generator is exercised separately; here it is replaced so these tests can inspect exactly what the
// invoice would contain (and so no files are written to disk).
vi.mock('../src/services/pdfService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/pdfService')>();
  return { ...original, generateInvoicePdf: vi.fn(async () => ({ url: 'https://files.example.test/invoice.pdf' })) };
});

import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser } from './setup';
import { generateInvoicePdf } from '../src/services/pdfService';
import { Product } from '../src/models/Product';
import { Category } from '../src/models/Category';
import { Coupon } from '../src/models/Coupon';
import { Order } from '../src/models/Order';
import { Invoice } from '../src/models/Invoice';
import { Setting } from '../src/models/AuditLog';
import { Cart } from '../src/models/Cart';
import { env } from '../src/config/env';

const address = (state: string) => ({
  contactName: 'Asha Verma', phone: '9876543210', line1: '14 MG Road', city: 'Pune', state, pincode: '411001'
});

async function product(overrides: Record<string, unknown> = {}) {
  const category = (await Category.findOne({ slug: 'orders-test' })) ?? (await Category.create({ name: 'Orders Test', slug: 'orders-test', isActive: true }));
  const n = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return Product.create({
    name: `Extinguisher ${n}`, slug: `extinguisher-${n}`, sku: `EXT-${n}`, category: category._id,
    price: 1000, gstPercentage: 18, stock: 20, brand: 'FireGuard', shortDescription: 's', description: 'd', isActive: true,
    ...overrides
  });
}

async function addToCart(token: string, productId: string, quantity: number) {
  const res = await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ productId, quantity });
  expect(res.status).toBeLessThan(300);
}

const checkout = (token: string, body: Record<string, unknown> = {}) =>
  request(app).post('/api/orders/checkout').set('Authorization', `Bearer ${token}`).send({
    billingAddress: address('Maharashtra'), shippingAddress: address('Maharashtra'), paymentMethod: 'mock', ...body
  });

async function coupon(overrides: Record<string, unknown> = {}) {
  return Coupon.create({
    code: `SAVE${Math.floor(Math.random() * 1e6)}`, discountType: 'fixed', discountValue: 300, minimumOrder: 0,
    startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000), isActive: true, ...overrides
  });
}

describe('Checkout: totals are computed by the real endpoint', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    vi.mocked(generateInvoicePdf).mockClear();
    await clearCollections('users', 'products', 'categories', 'carts', 'orders', 'payments', 'invoices', 'coupons', 'settings', 'counters', 'notifications');
    await Setting.create({ key: 'company', value: { companyName: 'Acme Fire', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', address: 'Mumbai' } });
  });

  it('no coupon: GST on the full amount, free shipping from Rs 2,000', async () => {
    const { token } = await createTestUser('customer');
    const p = await product();
    await addToCart(token, p._id.toString(), 3); // 3 x 1000 = 3000

    const res = await checkout(token);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ subtotal: 3000, discount: 0, gstAmount: 540, shippingFee: 0, totalAmount: 3540 });
  });

  it('adds Rs 99 shipping under Rs 2,000', async () => {
    const { token } = await createTestUser('customer');
    const p = await product();
    await addToCart(token, p._id.toString(), 1);
    const res = await checkout(token);
    expect(res.body.data).toMatchObject({ subtotal: 1000, gstAmount: 180, shippingFee: 99, totalAmount: 1279 });
  });

  it('with a coupon, GST is charged on the DISCOUNTED amount (the old code taxed the full amount)', async () => {
    const { token } = await createTestUser('customer');
    const p = await product();
    const c = await coupon({ discountValue: 300 });
    await addToCart(token, p._id.toString(), 3);

    const res = await checkout(token, { couponCode: c.code });
    expect(res.status).toBe(201);
    // taxable 3000 - 300 = 2700; GST 18% = 486; total 3186. (Old code: GST 540, total 3240.)
    expect(res.body.data).toMatchObject({ subtotal: 3000, discount: 300, gstAmount: 486, totalAmount: 3186, couponCode: c.code });
    expect(res.body.data.items[0]).toMatchObject({ taxableValue: 2700, gstAmount: 486 });
  });

  it('percentage coupons respect the maximum discount cap', async () => {
    const { token } = await createTestUser('customer');
    const p = await product({ price: 5000 });
    const c = await coupon({ discountType: 'percentage', discountValue: 20, maximumDiscount: 500 });
    await addToCart(token, p._id.toString(), 1);
    const res = await checkout(token, { couponCode: c.code });
    expect(res.body.data.discount).toBe(500);
    expect(res.body.data.gstAmount).toBe(810); // 18% of (5000 - 500)
    expect(res.body.data.totalAmount).toBe(5310);
  });

  it('the cart summary shows exactly the amount the checkout charges', async () => {
    const { token } = await createTestUser('customer');
    const p = await product();
    const c = await coupon({ discountValue: 300 });
    await addToCart(token, p._id.toString(), 3);
    const applied = await request(app).post('/api/cart/coupon').set('Authorization', `Bearer ${token}`).send({ code: c.code });
    expect(applied.status).toBe(200);

    const cart = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    const summary = cart.body.data.summary ?? cart.body.data;
    const order = await checkout(token, { couponCode: c.code });
    expect(summary.total ?? summary.totalAmount).toBe(order.body.data.totalAmount);
    expect(summary.gstAmount).toBe(order.body.data.gstAmount);
  });

  it('decrements stock, clears the cart, and records the payment', async () => {
    const { token, user } = await createTestUser('customer');
    const p = await product({ stock: 5 });
    await addToCart(token, p._id.toString(), 2);
    expect((await checkout(token)).status).toBe(201);
    expect((await Product.findById(p._id))!.stock).toBe(3);
    expect((await Cart.findOne({ user: user._id }))?.items ?? []).toHaveLength(0);
  });

  it('rejects an empty cart, an unknown payment method and missing address fields', async () => {
    const { token } = await createTestUser('customer');
    expect((await checkout(token)).status).toBe(400);
    expect((await checkout(token, { paymentMethod: 'bitcoin' })).status).toBe(422);
    expect((await checkout(token, { shippingAddress: { city: 'Pune' } })).status).toBe(422);
    expect((await request(app).post('/api/orders/checkout').send({})).status).toBe(401);
  });

  it('refuses to oversell: insufficient stock fails the checkout and leaves stock and cart untouched', async () => {
    const { token } = await createTestUser('customer');
    const plenty = await product({ stock: 10 });
    const scarce = await product({ stock: 1 });
    await addToCart(token, plenty._id.toString(), 2);
    await addToCart(token, scarce._id.toString(), 1);
    await Product.updateOne({ _id: scarce._id }, { $set: { stock: 0 } }); // sold out between "add to cart" and "pay"

    const res = await checkout(token);
    expect(res.status).toBe(400);
    expect((await Product.findById(plenty._id))!.stock).toBe(10); // the earlier decrement was given back
    expect(await Order.countDocuments()).toBe(0);
  });
});

describe('Checkout: coupon rules', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    vi.mocked(generateInvoicePdf).mockClear();
    await clearCollections('users', 'products', 'categories', 'carts', 'orders', 'payments', 'invoices', 'coupons', 'settings', 'counters', 'notifications');
    await Setting.create({ key: 'company', value: { companyName: 'Acme Fire', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra' } });
  });

  async function cartWith(quantity = 3) {
    const { token } = await createTestUser('customer');
    const p = await product();
    await addToCart(token, p._id.toString(), quantity);
    return { token, p };
  }

  it('rejects an expired coupon, a not-yet-active one, an unknown code and an inactive one - with the stock untouched', async () => {
    const { token, p } = await cartWith();
    const expired = await coupon({ endDate: new Date(Date.now() - 1000) });
    const future = await coupon({ startDate: new Date(Date.now() + 86_400_000), endDate: new Date(Date.now() + 2 * 86_400_000) });
    const inactive = await coupon({ isActive: false });
    for (const code of [expired.code, future.code, inactive.code, 'NOSUCHCODE']) {
      const res = await checkout(token, { couponCode: code });
      expect(res.status, code).toBe(400);
    }
    expect((await Product.findById(p._id))!.stock).toBe(20);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('rejects a coupon when the cart is below its minimum order', async () => {
    const { token } = await cartWith(1); // subtotal 1000
    const c = await coupon({ minimumOrder: 5000 });
    expect((await checkout(token, { couponCode: c.code })).status).toBe(400);
  });

  it('counts a use only when an order is actually created, and stops at the usage limit', async () => {
    const c = await coupon({ usageLimit: 1 });
    const first = await cartWith();
    expect((await checkout(first.token, { couponCode: c.code })).status).toBe(201);
    expect((await Coupon.findById(c._id))!.usedCount).toBe(1);

    const second = await cartWith();
    const res = await checkout(second.token, { couponCode: c.code });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/usage limit/i);
    expect((await Coupon.findById(c._id))!.usedCount).toBe(1);
  });

  it('gives the coupon use back when the checkout fails afterwards (e.g. out of stock)', async () => {
    const { token, p } = await cartWith(2);
    const c = await coupon({ usageLimit: 5 });
    // A second line that cannot be fulfilled makes the whole checkout fail AFTER the coupon was claimed.
    const scarce = await product({ stock: 1 });
    await addToCart(token, scarce._id.toString(), 1);
    await Product.updateOne({ _id: scarce._id }, { $set: { stock: 0 } });

    const res = await checkout(token, { couponCode: c.code });
    expect(res.status).toBe(400);
    expect((await Coupon.findById(c._id))!.usedCount).toBe(0);
    expect((await Product.findById(p._id))!.stock).toBe(20);
  });
});

describe('Invoices created at checkout', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    vi.mocked(generateInvoicePdf).mockClear();
    await clearCollections('users', 'products', 'categories', 'carts', 'orders', 'payments', 'invoices', 'coupons', 'settings', 'counters', 'notifications');
  });

  async function placeOrder(opts: { shippingState?: string; couponDiscount?: number; qty?: number } = {}) {
    const { token } = await createTestUser('customer');
    const p = await product();
    await addToCart(token, p._id.toString(), opts.qty ?? 3);
    const c = opts.couponDiscount ? await coupon({ discountValue: opts.couponDiscount }) : null;
    return checkout(token, {
      shippingAddress: address(opts.shippingState ?? 'Maharashtra'),
      ...(c ? { couponCode: c.code } : {})
    });
  }

  it('is generated with discount, taxable value and shipping so the printed totals add up', async () => {
    await Setting.create({ key: 'company', value: { companyName: 'Acme Fire', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra' } });
    const res = await placeOrder({ couponDiscount: 300, qty: 1 }); // 1000 - 300 = 700 taxable
    expect(res.status).toBe(201);

    expect(generateInvoicePdf).toHaveBeenCalledTimes(1);
    const input = vi.mocked(generateInvoicePdf).mock.calls[0][0];
    expect(input.totals).toMatchObject({ subtotal: 1000, discount: 300, taxableTotal: 700, totalGst: 126, shippingFee: 99, grandTotal: 925 });
    // The three printed components reconcile with the grand total.
    expect(input.totals.taxableTotal! + input.totals.totalGst + input.totals.shippingFee!).toBe(input.totals.grandTotal);
    expect(input.company.gstin).toBe('27ABCDE1234F1Z5');

    const invoice = await Invoice.findOne();
    expect(invoice).toMatchObject({ discount: 300, shippingFee: 99, taxableTotal: 700, grandTotal: 925 });
  });

  it('splits GST into CGST+SGST inside the seller state and IGST outside it', async () => {
    await Setting.create({ key: 'company', value: { companyName: 'Acme Fire', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra' } });
    await placeOrder({ shippingState: 'Maharashtra', qty: 3 });
    const intra = vi.mocked(generateInvoicePdf).mock.calls[0][0].items[0];
    expect(intra).toMatchObject({ cgst: 270, sgst: 270, igst: 0 });

    vi.mocked(generateInvoicePdf).mockClear();
    await placeOrder({ shippingState: 'Karnataka', qty: 3 });
    const inter = vi.mocked(generateInvoicePdf).mock.calls[0][0].items[0];
    expect(inter).toMatchObject({ cgst: 0, sgst: 0, igst: 540 });
  });

  it('never prints a made-up GSTIN: in production a missing GSTIN stops the invoice but NOT the order', async () => {
    const original = env.nodeEnv;
    try {
      (env as { nodeEnv: string }).nodeEnv = 'production';
      const res = await placeOrder();
      expect(res.status).toBe(201); // the customer's order is safe
      expect(await Order.countDocuments()).toBe(1);
      expect(await Invoice.countDocuments()).toBe(0); // no invoice with a fake number
      expect(generateInvoicePdf).not.toHaveBeenCalled();
    } finally {
      (env as { nodeEnv: string }).nodeEnv = original;
    }
  });

  it('an invoice failure after payment does NOT undo the order or return the stock', async () => {
    await Setting.create({ key: 'company', value: { companyName: 'Acme Fire', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra' } });
    vi.mocked(generateInvoicePdf).mockRejectedValueOnce(new Error('PDF service is down'));

    const { token } = await createTestUser('customer');
    const p = await product({ stock: 10 });
    await addToCart(token, p._id.toString(), 2);
    const res = await checkout(token);

    expect(res.status).toBe(201);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Product.findById(p._id))!.stock).toBe(8); // still deducted, because the order really exists
    expect(await Invoice.countDocuments()).toBe(0);
  });

  it('staff can regenerate a missing invoice later, and doing it twice does not duplicate it', async () => {
    await Setting.create({ key: 'company', value: { companyName: 'Acme Fire', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra' } });
    vi.mocked(generateInvoicePdf).mockRejectedValueOnce(new Error('temporary'));
    const res = await placeOrder();
    expect(await Invoice.countDocuments()).toBe(0);

    const admin = await createTestUser('admin');
    const orderId = res.body.data._id;
    const status = (s: string) => request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: s });
    // moving the order forward triggers the (retried) invoice for a paid order
    expect((await status('confirmed')).status).toBe(200);
    expect((await status('processing')).status).toBeLessThan(500);
    expect(await Invoice.countDocuments()).toBe(1);
  });
});
