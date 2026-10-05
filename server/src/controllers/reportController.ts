import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Quote } from '../models/Quote';
import { Product } from '../models/Product';
import { ServiceBooking } from '../models/ServiceBooking';
import { AMCContract } from '../models/AMCContract';
import { User } from '../models/User';
import { Technician } from '../models/Technician';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { escapeRegex } from '../utils/escapeRegex';

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

// ============================================================================
// ADMIN DASHBOARD V2
// ============================================================================

// Jobs a technician can hold at once before they are shown as fully loaded (100%).
const TECHNICIAN_MAX_CONCURRENT_JOBS = Number(process.env.TECHNICIAN_MAX_CONCURRENT_JOBS) || 4;
export const dashboardV2 = asyncHandler(async (req: Request, res: Response) => {
  // Customer phone/email appear in the renewals list only for people who may read customers; everyone with
  // reports.read still sees the name and plan.
  const canSeeCustomerContacts =
    req.user!.role === 'super_admin' || (req.user!.permissions as string[]).includes('customers.read');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const nextThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [
    revenueTrend,
    jobsByStatusAgg,
    amcRenewalsDue,
    lowStockItems,
    technicians,
    activeJobsCount,
    completedJobsCount
  ] = await Promise.all([
    // 1. Revenue trend over last 30 days
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // 2. Jobs by status
    ServiceBooking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),

    // 3. AMC renewals due in 30 days
    AMCContract.find({
      endDate: { $gte: new Date(), $lte: nextThirtyDays },
      status: { $in: ['active', 'expiring_soon'] }
    })
      .populate('user', canSeeCustomerContacts ? 'name email phone' : 'name')
      .select('planName endDate status user')
      .sort({ endDate: 1 })
      .limit(10),

    // 4. Low stock inventory
    Product.find({ isActive: true, stock: { $lte: 5 } })
      .populate('category', 'name')
      .select('name sku stock price category')
      .sort({ stock: 1 })
      .limit(10),

    // 5. Active technicians for utilisation tracking
    Technician.find({ status: 'active' }).select('name phone email skills'),

    // Total active jobs
    ServiceBooking.countDocuments({ status: { $in: ['assigned', 'technician_on_the_way', 'in_progress'] } }),

    // Total completed jobs this month
    ServiceBooking.countDocuments({ status: 'completed', completedAt: { $gte: thirtyDaysAgo } })
  ]);

  // Format jobs by status dictionary
  const jobsByStatus: Record<string, number> = {
    requested: 0,
    confirmed: 0,
    assigned: 0,
    technician_on_the_way: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    rejected: 0
  };
  jobsByStatusAgg.forEach((item) => {
    if (item._id) jobsByStatus[item._id] = item.count;
  });

  // Calculate technician utilisation metrics
  const technicianUtilisation = await Promise.all(
    technicians.map(async (t) => {
      const [currentAssigned, completedRecent] = await Promise.all([
        ServiceBooking.countDocuments({
          assignedTechnician: t._id,
          status: { $in: ['assigned', 'technician_on_the_way', 'in_progress'] }
        }),
        ServiceBooking.countDocuments({
          assignedTechnician: t._id,
          status: 'completed',
          completedAt: { $gte: thirtyDaysAgo }
        })
      ]);
      // The Technician model has no per-person capacity field, so one shared setting is used for everyone.
      const maxLoad = TECHNICIAN_MAX_CONCURRENT_JOBS;
      const loadPercentage = Math.min(100, Math.round((currentAssigned / maxLoad) * 100));
      return {
        id: t._id,
        name: t.name,
        phone: t.phone,
        skills: t.skills || [],
        currentAssigned,
        completedRecent,
        maxLoad,
        loadPercentage
      };
    })
  );

  return ok(res, {
    revenueTrend,
    jobsByStatus,
    amcRenewalsDue,
    lowStockItems,
    technicianUtilisation,
    summary: {
      activeJobsCount,
      completedJobsCount
    }
  });
});

// ============================================================================
// GLOBAL SEARCH (CTRL+K) ACROSS ORDERS, CUSTOMERS, BOOKINGS, PRODUCTS
// ============================================================================
export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const empty = { orders: [], customers: [], bookings: [], products: [] };
  if (q.length < 2) return ok(res, empty);

  // Each group is only searched (and only returned) if the caller may read that kind of data. Having
  // "reports.read" is NOT enough to see customers' contact details.
  const isSuper = req.user!.role === 'super_admin';
  const can = (...perms: string[]) => isSuper || perms.some((p) => (req.user!.permissions as string[]).includes(p));

  const regex = new RegExp(escapeRegex(q), 'i');

  // Technicians only ever see their own assigned jobs (same rule as the bookings list), never every customer's.
  let bookingScope: Record<string, unknown> | null = {};
  if (req.user!.role === 'technician') {
    const technician = await Technician.findOne({ user: req.user!.id, status: 'active' }).select('_id');
    bookingScope = technician ? { assignedTechnician: technician._id } : null;
  }

  const [orders, customers, bookings, products] = await Promise.all([
    can('orders.read')
      ? Order.find({ $or: [{ orderNumber: regex }, { 'shippingAddress.phone': regex }, { 'shippingAddress.city': regex }] })
          .populate('user', 'name')
          .select('orderNumber totalAmount status createdAt user')
          .sort({ createdAt: -1 })
          .limit(6)
      : [],
    can('customers.read')
      ? User.find({ role: 'customer', $or: [{ name: regex }, { email: regex }, { phone: regex }] })
          .select('name email phone role createdAt')
          .limit(6)
      : [],
    can('service_bookings.read') && bookingScope
      ? ServiceBooking.find({ ...bookingScope, $or: [{ bookingNumber: regex }, { phone: regex }, { address: regex }] })
          .populate('user', 'name')
          .populate('service', 'name')
          .select('bookingNumber serviceType status preferredDate phone address user service')
          .sort({ createdAt: -1 })
          .limit(6)
      : [],
    can('products.read')
      ? Product.find({ $or: [{ name: regex }, { sku: regex }] }).select('name sku price stock image').limit(6)
      : []
  ]);

  // Links point at list pages that exist in the admin app, with ?q= so the table opens already filtered.
  return ok(res, {
    orders: orders.map((o) => ({
      id: o._id,
      title: o.orderNumber,
      subtitle: `${(o.user as unknown as { name?: string })?.name || 'Guest'} · ₹${o.totalAmount.toLocaleString('en-IN')}`,
      type: 'Order',
      status: o.status,
      link: `/orders?q=${encodeURIComponent(o.orderNumber)}`
    })),
    customers: customers.map((c) => ({
      id: c._id,
      title: c.name,
      subtitle: `${c.email}${c.phone ? ` · ${c.phone}` : ''}`,
      type: 'Customer',
      status: 'active',
      link: `/customers?q=${encodeURIComponent(c.email)}`
    })),
    bookings: bookings.map((b) => ({
      id: b._id,
      title: b.bookingNumber,
      subtitle: `${(b.service as unknown as { name?: string })?.name || b.serviceType.replace(/[-_]/g, ' ')} · ${b.phone}`,
      type: 'Booking',
      status: b.status,
      link: `/bookings?q=${encodeURIComponent(b.bookingNumber)}`
    })),
    products: products.map((p) => ({
      id: p._id,
      title: p.name,
      subtitle: `SKU: ${p.sku} · Stock: ${p.stock} · ₹${p.price.toLocaleString('en-IN')}`,
      type: 'Product',
      status: p.stock > 0 ? 'in_stock' : 'out_of_stock',
      link: `/products?q=${encodeURIComponent(p.sku || p.name)}`
    }))
  });
});
