import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';

export const listCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  return ok(res, coupons);
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.body.code).toUpperCase();
  const exists = await Coupon.findOne({ code });
  if (exists) throw ApiError.conflict('A coupon with this code already exists');

  const coupon = await Coupon.create({ ...req.body, code });
  await writeAuditLog(req, 'create', 'coupons', 'Coupon', coupon._id, null, coupon.toObject());
  return created(res, coupon);
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  const previous = coupon.toObject();

  Object.assign(coupon, req.body);
  await coupon.save();

  await writeAuditLog(req, 'update', 'coupons', 'Coupon', coupon._id, previous, coupon.toObject());
  return ok(res, coupon, 'Coupon updated');
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return ok(res, {}, 'Coupon deleted');
});
