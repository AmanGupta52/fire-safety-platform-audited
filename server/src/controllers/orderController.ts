import { Request, Response } from 'express';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { Order, OrderStatus } from '../models/Order';
import { Payment } from '../models/Payment';
import { Coupon } from '../models/Coupon';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created, paginationMeta } from '../utils/apiResponse';
import { priceLines, applyDiscount } from '../services/pricingService';
import { nextNumber } from '../services/numberingService';
import { notify } from '../services/notificationService';
import { emailTemplates } from '../services/emailService';
import { generateInvoiceForOrder } from '../services/invoiceService';
import { writeAuditLog } from '../services/auditService';

/**
 * Checkout: validate user -> validate cart -> validate stock -> calculate prices/discount/GST
 * -> create order -> create payment record -> update inventory -> clear cart -> notify -> invoice.
 *
 * Deliberately does NOT use a MongoDB multi-document transaction: transactions require a replica set
 * (mongos/replSet), which a default local `mongod` does not have, and the spec calls for the app to work
 * without any special paid/managed setup in development. Instead, stock is decremented with a single
 * atomic conditional update per item ($inc guarded by a stock >= quantity filter), which is safe against
 * concurrent checkouts on its own. If a later item in the same checkout fails validation, every stock
 * decrement already applied earlier in this request is compensated (added back) before returning the error,
 * so a failed checkout never leaves inventory short.
 */
export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { billingAddress, shippingAddress, companyName, gstNumber, couponCode, paymentMethod } = req.body;

  const cart = await Cart.findOne({ user: req.user!.id }).populate('items.product');
  if (!cart || cart.items.length === 0) throw ApiError.badRequest('Your cart is empty');

  const orderItems: {
    product: any; name: string; sku: string; quantity: number; unitPrice: number; gstPercentage: number; lineTotal: number;
  }[] = [];
  const lines: { quantity: number; unitPrice: number; gstPercentage: number }[] = [];
  const decremented: { productId: string; quantity: number }[] = [];

  async function rollbackDecrements() {
    for (const d of decremented) {
      await Product.updateOne({ _id: d.productId }, { $inc: { stock: d.quantity } }).catch(() => undefined);
    }
  }

  try {
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive) throw ApiError.badRequest('One or more items are no longer available');

      const unitPrice = product.discountPrice ?? product.price;
      const lineTotal = Math.round(unitPrice * item.quantity * (1 + product.gstPercentage / 100) * 100) / 100;

      if (product.allowBackorder) {
        await Product.updateOne({ _id: product._id }, { $inc: { stock: -item.quantity } });
      } else {
        // Atomic, race-safe stock decrement: only succeeds if enough stock is still available at the moment of the write.
        const result = await Product.updateOne(
          { _id: product._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );
        if (result.matchedCount === 0) {
          throw ApiError.badRequest(`Insufficient stock for ${product.name}`);
        }
      }
      decremented.push({ productId: product._id.toString(), quantity: item.quantity });

      orderItems.push({
        product: product._id, name: product.name, sku: product.sku,
        quantity: item.quantity, unitPrice, gstPercentage: product.gstPercentage, lineTotal
      });
      lines.push({ quantity: item.quantity, unitPrice, gstPercentage: product.gstPercentage });
    }

    const { subtotal, gstAmount } = priceLines(lines);

    let discount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      appliedCoupon = await Coupon.findOne({ code: String(couponCode).toUpperCase(), isActive: true });
      if (appliedCoupon && subtotal >= appliedCoupon.minimumOrder) {
        discount = applyDiscount(subtotal, appliedCoupon);
        await Coupon.updateOne({ _id: appliedCoupon._id }, { $inc: { usedCount: 1 } });
      }
    }

    const shippingFee = subtotal > 0 && subtotal < 2000 ? 99 : 0;
    const totalAmount = Math.round((subtotal - discount + gstAmount + shippingFee) * 100) / 100;

    const orderNumber = await nextNumber('order', 'ORD');

    const order = await Order.create({
      orderNumber, user: req.user!.id, items: orderItems, subtotal, discount,
      couponCode: appliedCoupon?.code, gstAmount, shippingFee, totalAmount,
      status: 'pending', paymentStatus: 'unpaid',
      paymentMethod, billingAddress, shippingAddress, companyName, gstNumber
    });

    // Payment record — mock mode never represents a real charge as successful money movement.
    const paymentStatus = paymentMethod === 'mock' ? 'success' : 'initiated';
    await Payment.create({
      order: order._id, user: req.user!.id, amount: totalAmount, method: paymentMethod,
      status: paymentStatus, providerReferenceId: paymentMethod === 'mock' ? `MOCK-${order.orderNumber}` : undefined
    });

    if (paymentMethod === 'mock') {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
    }

    cart.items = [];
    cart.couponCode = undefined;
    await cart.save();

    const user = await User.findById(req.user!.id);
    await notify({
      userId: req.user!.id,
      type: 'order_confirmation',
      title: 'Order Confirmed',
      message: `Your order ${order.orderNumber} has been placed successfully.`,
      email: user?.email,
      emailHtml: emailTemplates.orderConfirmation(order.orderNumber, order.totalAmount),
      phone: user?.phone
    });

    if (order.paymentStatus === 'paid') {
      await generateInvoiceForOrder(order._id.toString());
    }

    return created(res, order, 'Order placed successfully');
  } catch (err) {
    await rollbackDecrements();
    throw err;
  }
});

export const myOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const [items, total] = await Promise.all([
    Order.find({ user: req.user!.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments({ user: req.user!.id })
  ]);
  return ok(res, items, 'Orders fetched', paginationMeta(page, limit, total));
});

export const getMyOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.id });
  if (!order) throw ApiError.notFound('Order not found');
  return ok(res, order);
});

export const cancelMyOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.id });
  if (!order) throw ApiError.notFound('Order not found');
  if (!['pending', 'confirmed'].includes(order.status)) {
    throw ApiError.badRequest('This order can no longer be cancelled');
  }

  order.status = 'cancelled';
  order.cancelReason = req.body.reason || 'Cancelled by customer';
  await order.save();

  // Restock cancelled items.
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }

  return ok(res, order, 'Order cancelled');
});

// ---------- Admin ----------

export const adminListOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter: Record<string, unknown> = {};
  // SECURITY: coerce to String() so a crafted `?status[$ne]=` query-string can't inject a Mongo
  // operator, and escape regex metacharacters in the free-text search so a crafted
  // orderNumber (e.g. a pathological alternation) can't trigger catastrophic backtracking (ReDoS).
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.paymentStatus) filter.paymentStatus = String(req.query.paymentStatus);
  if (req.query.orderNumber) {
    const escaped = String(req.query.orderNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.orderNumber = { $regex: escaped, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter)
  ]);
  return ok(res, items, 'Orders fetched', paginationMeta(page, limit, total));
});

export const adminUpdateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, assignedDeliveryNote } = req.body as { status: OrderStatus; assignedDeliveryNote?: string };
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  const previous = order.toObject();

  order.status = status;
  if (assignedDeliveryNote) order.assignedDeliveryNote = assignedDeliveryNote;
  if (status === 'delivered' && order.paymentMethod === 'cod') order.paymentStatus = 'paid';
  await order.save();

  await writeAuditLog(req, 'update_status', 'orders', 'Order', order._id, previous, order.toObject());

  const user = await User.findById(order.user);
  await notify({
    userId: order.user, type: 'order_status', title: 'Order Status Updated',
    message: `Order ${order.orderNumber} is now ${status}.`,
    email: user?.email, emailHtml: emailTemplates.orderStatus(order.orderNumber, status)
  });

  if (order.paymentStatus === 'paid') {
    await generateInvoiceForOrder(order._id.toString());
  }

  return ok(res, order, 'Order status updated');
});
