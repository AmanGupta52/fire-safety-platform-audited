import { Request, Response } from 'express';
import { CustomerEquipment } from '../models/CustomerEquipment';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';

export const listMyEquipment = asyncHandler(async (req: Request, res: Response) => {
  const equipment = await CustomerEquipment.find({ user: req.user!.id }).sort({ createdAt: -1 });
  const withStatus = equipment.map((e) => ({ ...e.toObject(), status: e.computeStatus() }));
  return ok(res, withStatus);
});

export const getMyEquipment = asyncHandler(async (req: Request, res: Response) => {
  const equipment = await CustomerEquipment.findOne({ _id: req.params.id, user: req.user!.id });
  if (!equipment) throw ApiError.notFound('Equipment not found');
  return ok(res, { ...equipment.toObject(), status: equipment.computeStatus() });
});

export const registerEquipment = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const equipment = await CustomerEquipment.create({
    user: req.user!.id,
    product: body.productId || null,
    productNameSnapshot: body.productNameSnapshot,
    serialNumber: body.serialNumber,
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
    installationDate: body.installationDate ? new Date(body.installationDate) : undefined,
    installationLocation: body.installationLocation,
    lastInspectionDate: body.lastInspectionDate ? new Date(body.lastInspectionDate) : undefined,
    lastRefillDate: body.lastRefillDate ? new Date(body.lastRefillDate) : undefined,
    nextInspectionDate: body.nextInspectionDate ? new Date(body.nextInspectionDate) : undefined,
    nextRefillDate: body.nextRefillDate ? new Date(body.nextRefillDate) : undefined,
    notes: body.notes
  });
  return created(res, equipment, 'Equipment registered');
});

export const updateMyEquipment = asyncHandler(async (req: Request, res: Response) => {
  const equipment = await CustomerEquipment.findOne({ _id: req.params.id, user: req.user!.id });
  if (!equipment) throw ApiError.notFound('Equipment not found');

  const editable = [
    'productNameSnapshot', 'serialNumber', 'purchaseDate', 'installationDate', 'installationLocation',
    'lastInspectionDate', 'lastRefillDate', 'nextInspectionDate', 'nextRefillDate', 'notes'
  ];
  for (const key of editable) {
    if (req.body[key] !== undefined) (equipment as any)[key] = req.body[key];
  }
  await equipment.save();
  return ok(res, { ...equipment.toObject(), status: equipment.computeStatus() }, 'Equipment updated');
});

// ---------- Admin ----------

export const adminListEquipment = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.userId) filter.user = req.query.userId;
  const equipment = await CustomerEquipment.find(filter).populate('user', 'name email phone').sort({ nextRefillDate: 1 });
  const withStatus = equipment.map((e) => ({ ...e.toObject(), status: e.computeStatus() }));
  return ok(res, withStatus);
});

export const adminDueEquipment = asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 30;
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const equipment = await CustomerEquipment.find({
    $or: [{ nextInspectionDate: { $lte: cutoff } }, { nextRefillDate: { $lte: cutoff } }]
  }).populate('user', 'name email phone');
  const withStatus = equipment.map((e) => ({ ...e.toObject(), status: e.computeStatus() }));
  return ok(res, withStatus);
});
