import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Quote } from '../models/Quote';
import { Product } from '../models/Product';
import { ServiceBooking } from '../models/ServiceBooking';
import { AMCContract } from '../models/AMCContract';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }

// SECURITY: CSV/formula injection guard. A customer's name (or any other free-text field) is
// attacker-controlled and ends up in a CSV that staff open in Excel/Sheets. If a cell's content
// starts with =, +, -, @, or a tab/CR (recognised as formula-leading characters by spreadsheet
// apps), the app can execute it as a formula on open. Prefixing with a leading apostrophe forces
// it to be treated as plain text while keeping the visible value unchanged.
function csvSafe(value: unknown): string {
  const str = String(value ?? '');
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

export const dashboardSummary = asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalRevenueAgg, todayRevenueAgg, monthRevenueAgg,
    totalOrders, pendingOrders, pendingQuotes, activeCustomers,
    amcDue, servicesToday, lowStockCount
  ] = await Promise.all([
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'paid', createdAt: { $gte: startOfDay() } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'paid', createdAt: { $gte: startOfMonth() } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.countDocuments(),
    Order.countDocuments({ status: 'pending' }),
    Quote.countDocuments({ status: { $in: ['requested', 'reviewing'] } }),
    User.countDocuments({ role: 'customer', isActive: true }),
    AMCContract.countDocuments({ endDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, status: { $in: ['active', 'expiring_soon'] } }),
    ServiceBooking.countDocuments({ preferredDate: { $gte: startOfDay(), $lt: new Date(startOfDay().getTime() + 86400000) } }),
    Product.countDocuments({ isActive: true, stock: { $lte: 5 } })
  ]);

  return ok(res, {
    totalRevenue: totalRevenueAgg[0]?.total || 0,
    todayRevenue: todayRevenueAgg[0]?.total || 0,
    monthlyRevenue: monthRevenueAgg[0]?.total || 0,
    totalOrders, pendingOrders, pendingQuotes, activeCustomers,
    amcDue, servicesToday, lowStockProducts: lowStockCount
  });
});

export const revenueChart = asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const data = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  return ok(res, data);
});

export const salesByCategory = asyncHandler(async (_req: Request, res: Response) => {
  const data = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $lookup: { from: 'categories', localField: 'product.category', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    { $group: { _id: '$category.name', revenue: { $sum: '$items.lineTotal' }, unitsSold: { $sum: '$items.quantity' } } },
    { $sort: { revenue: -1 } }
  ]);
  return ok(res, data);
});

export const topProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  const data = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $first: '$items.name' }, revenue: { $sum: '$items.lineTotal' }, unitsSold: { $sum: '$items.quantity' } } },
    { $sort: { revenue: -1 } },
    { $limit: limit }
  ]);
  return ok(res, data);
});

export const topCustomers = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  const data = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: '$user', totalSpent: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } },
    { $sort: { totalSpent: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { name: '$user.name', email: '$user.email', totalSpent: 1, orderCount: 1 } }
  ]);
  return ok(res, data);
});

export const amcRenewalRate = asyncHandler(async (_req: Request, res: Response) => {
  const [expired, renewed] = await Promise.all([
    AMCContract.countDocuments({ status: 'expired' }),
    AMCContract.countDocuments({ status: 'renewed' })
  ]);
  const total = expired + renewed;
  return ok(res, { expired, renewed, renewalRate: total ? Math.round((renewed / total) * 100) : 0 });
});

export const serviceCompletionRate = asyncHandler(async (_req: Request, res: Response) => {
  const [total, completed, pending] = await Promise.all([
    ServiceBooking.countDocuments(),
    ServiceBooking.countDocuments({ status: 'completed' }),
    ServiceBooking.countDocuments({ status: { $nin: ['completed', 'cancelled'] } })
  ]);
  return ok(res, { total, completed, pending, completionRate: total ? Math.round((completed / total) * 100) : 0 });
});

// CSV export helper: simple, dependency-light CSV builder (no xlsx needed server-side for exports).
export const exportOrdersCsv = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(5000);
  const rows = [
    ['Order Number', 'Customer', 'Email', 'Status', 'Payment Status', 'Total', 'Date'],
    ...orders.map((o) => [
      csvSafe(o.orderNumber), csvSafe((o.user as any)?.name || ''), csvSafe((o.user as any)?.email || ''),
      csvSafe(o.status), csvSafe(o.paymentStatus), o.totalAmount.toFixed(2), o.createdAt.toISOString()
    ])
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
  res.send(csv);
});
