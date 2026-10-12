import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, detectEmulatedMongo } from './setup';
import { Order } from '../src/models/Order';
import { ServiceBooking } from '../src/models/ServiceBooking';
import { setCacheEnabled, reportCache } from '../src/utils/ttlCache';

const EMULATED = await detectEmulatedMongo();

const get = (token: string, url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`);

describe('Report query parameters never cause a 500', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => { await clearCollections('users', 'orders'); });

  it('limit: negative, NaN, non-numeric, zero, huge and repeated values all return 200', async () => {
    const admin = await createTestUser('admin');
    for (const q of ['-5', 'abc', 'NaN', '0', '1e9', '999999', '2.5', '']) {
      for (const path of ['top-products', 'top-customers']) {
        const res = await get(admin.token, `/api/reports/${path}?limit=${q}`);
        expect(res.status, `${path}?limit=${q}`).toBe(200);
      }
    }
    expect((await get(admin.token, '/api/reports/top-products?limit=1&limit=2')).status).toBe(200);
    expect((await get(admin.token, '/api/reports/top-products?limit[$gt]=1')).status).toBe(200);
  });

  it.skipIf(EMULATED)('days: negative, huge, non-numeric all return 200', async () => {
    const admin = await createTestUser('admin');
    for (const q of ['-30', 'abc', '999999', '0', '1e9', '']) {
      const res = await get(admin.token, `/api/reports/revenue-chart?days=${q}`);
      expect(res.status, `days=${q}`).toBe(200);
    }
  });
});

// A fixed clock: 2026-10-08 19:00 UTC is already 00:30 on 9 Oct in India.
describe('Reports use the Indian calendar day and month', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('users', 'orders', 'servicebookings', 'products', 'categories', 'amccontracts', 'quotes');
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-08T19:00:00Z') });
  });
  afterEach(() => vi.useRealTimers());

  const orderBase = (customerId: unknown) => ({
    user: customerId, subtotal: 100, discount: 0, gstAmount: 0, shippingFee: 0, status: 'confirmed', paymentMethod: 'cod', paymentStatus: 'paid',
    items: [{ product: customerId, name: 'x', sku: 'x', quantity: 1, unitPrice: 100, gstPercentage: 0, lineTotal: 100 }],
    billingAddress: { contactName: 'a', phone: '9999999999', line1: 'l', city: 'c', state: 's', pincode: '111111' },
    shippingAddress: { contactName: 'a', phone: '9999999999', line1: 'l', city: 'c', state: 's', pincode: '111111' }
  });

  it.skipIf(EMULATED)('"servicesToday" is the IST day: 9 Oct 00:00-24:00 IST, not the UTC day', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    const at = (iso: string, n: string) => ServiceBooking.collection.insertOne({
      bookingNumber: `SRV-IST-${n}`, user: customer.user._id, serviceType: 'x', status: 'requested', preferredDate: new Date(iso), createdAt: new Date(), updatedAt: new Date()
    });
    await at('2026-10-08T18:29:00Z', 'before');   // 8 Oct 23:59 IST  -> yesterday in India
    await at('2026-10-08T18:31:00Z', 'start');    // 9 Oct 00:01 IST  -> today
    await at('2026-10-09T03:00:00Z', 'morning');  // 9 Oct 08:30 IST  -> today
    await at('2026-10-09T18:29:00Z', 'end');      // 9 Oct 23:59 IST  -> today
    await at('2026-10-09T18:31:00Z', 'after');    // 10 Oct 00:01 IST -> tomorrow

    const res = await get(admin.token, '/api/reports/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.servicesToday).toBe(3);
  });

  it.skipIf(EMULATED)('"todayRevenue" and "monthlyRevenue" follow IST day and month boundaries', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    const make = (n: string, total: number, createdAt: string) =>
      Order.collection.insertOne({ ...orderBase(customer.user._id), orderNumber: `ORD-IST-${n}`, totalAmount: total, createdAt: new Date(createdAt), updatedAt: new Date(createdAt) });
    await make('yesterday', 1, '2026-10-08T18:00:00Z');   // 8 Oct 23:30 IST
    await make('today-a', 10, '2026-10-08T18:45:00Z');    // 9 Oct 00:15 IST
    await make('today-b', 100, '2026-10-09T05:00:00Z');   // 9 Oct 10:30 IST
    await make('last-month', 1000, '2026-09-30T18:00:00Z'); // 30 Sep 23:30 IST

    const res = await get(admin.token, '/api/reports/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.todayRevenue).toBe(110);
    expect(res.body.data.monthlyRevenue).toBe(111); // 1 Oct 00:00 IST = 30 Sep 18:30 UTC, so the 18:00 UTC order is September
  });

  it.skipIf(EMULATED)('revenue chart groups orders into IST days', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    const make = (n: string, total: number, createdAt: string) =>
      Order.collection.insertOne({ ...orderBase(customer.user._id), orderNumber: `ORD-CH-${n}`, totalAmount: total, createdAt: new Date(createdAt), updatedAt: new Date(createdAt) });
    await make('a', 5, '2026-10-08T17:00:00Z');   // 8 Oct 22:30 IST
    await make('b', 7, '2026-10-08T19:00:00Z');   // 9 Oct 00:30 IST  (still 8 Oct in UTC)

    const res = await get(admin.token, '/api/reports/revenue-chart?days=7');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { _id: '2026-10-08', revenue: 5, orders: 1 },
      { _id: '2026-10-09', revenue: 7, orders: 1 }
    ]);
  });
});

describe('Dashboard reports are cached briefly, per permission level', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    setCacheEnabled(true);
    reportCache.clear();
    await clearCollections('users', 'orders', 'quotes');
  });
  afterEach(() => { setCacheEnabled(false); reportCache.clear(); });

  it.skipIf(EMULATED)('a repeat call within the TTL serves the cached numbers; the key includes the query string', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    const first = await get(admin.token, '/api/reports/dashboard');
    expect(first.body.data.totalOrders).toBe(0);

    await Order.collection.insertOne({
      orderNumber: 'ORD-CACHE-1', user: customer.user._id, totalAmount: 50, paymentStatus: 'paid', status: 'confirmed', paymentMethod: 'cod',
      createdAt: new Date(), updatedAt: new Date(), items: [], subtotal: 50, discount: 0, gstAmount: 0, shippingFee: 0
    });
    const second = await get(admin.token, '/api/reports/dashboard');
    expect(second.body.data.totalOrders).toBe(0); // cached
    const otherQuery = await get(admin.token, '/api/reports/dashboard?fresh=1');
    expect(otherQuery.body.data.totalOrders).toBe(1); // different key, so computed fresh
  });
});
