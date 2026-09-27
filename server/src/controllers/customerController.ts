import { Request, Response } from 'express';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { Quote } from '../models/Quote';
import { ServiceBooking } from '../models/ServiceBooking';
import { AMCContract } from '../models/AMCContract';
import { CustomerEquipment } from '../models/CustomerEquipment';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, paginationMeta } from '../utils/apiResponse';

export const adminListCustomers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter: Record<string, unknown> = { role: 'customer' };
  if (req.query.customerType) filter.customerType = req.query.customerType;
  if (req.query.q) {
    filter.$or = [
      { name: { $regex: String(req.query.q), $options: 'i' } },
      { email: { $regex: String(req.query.q), $options: 'i' } },
      { phone: { $regex: String(req.query.q), $options: 'i' } }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  return ok(res, users, 'Customers fetched', paginationMeta(page, limit, total));
});

export const adminGetCustomerProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findOne({ _id: req.params.id, role: 'customer' }).select('-password');
  if (!user) throw ApiError.notFound('Customer not found');

  const [orders, quotes, services, amc, equipment] = await Promise.all([
    Order.find({ user: user._id }).sort({ createdAt: -1 }),
    Quote.find({ user: user._id }).sort({ createdAt: -1 }),
    ServiceBooking.find({ user: user._id }).sort({ createdAt: -1 }),
    AMCContract.find({ user: user._id }),
    CustomerEquipment.find({ user: user._id })
  ]);

  const revenue = orders.filter((o) => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);

  return ok(res, { user, orders, quotes, services, amc, equipment, revenue });
});

export const adminUpdateCustomerTags = asyncHandler(async (req: Request, res: Response) => {
  const { tags, notes } = req.body as { tags?: string[]; notes?: string };
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'customer' },
    { ...(tags ? { tags } : {}), ...(notes !== undefined ? { notes } : {}) },
    { new: true }
  ).select('-password');
  if (!user) throw ApiError.notFound('Customer not found');
  return ok(res, user, 'Customer updated');
});

export const adminToggleCustomerActive = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findOne({ _id: req.params.id, role: 'customer' });
  if (!user) throw ApiError.notFound('Customer not found');
  user.isActive = !user.isActive;
  await user.save();
  return ok(res, user, `Customer ${user.isActive ? 'enabled' : 'disabled'}`);
});
