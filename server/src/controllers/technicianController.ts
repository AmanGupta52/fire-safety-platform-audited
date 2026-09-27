import { Request, Response } from 'express';
import { Technician } from '../models/Technician';
import { ServiceBooking } from '../models/ServiceBooking';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';

export const listTechnicians = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const technicians = await Technician.find(filter).sort({ name: 1 });
  return ok(res, technicians);
});

export const createTechnician = asyncHandler(async (req: Request, res: Response) => {
  const technician = await Technician.create(req.body);
  await writeAuditLog(req, 'create', 'technicians', 'Technician', technician._id, null, technician.toObject());
  return created(res, technician);
});

export const updateTechnician = asyncHandler(async (req: Request, res: Response) => {
  const technician = await Technician.findById(req.params.id);
  if (!technician) throw ApiError.notFound('Technician not found');
  const previous = technician.toObject();

  Object.assign(technician, req.body);
  await technician.save();

  await writeAuditLog(req, 'update', 'technicians', 'Technician', technician._id, previous, technician.toObject());
  return ok(res, technician, 'Technician updated');
});

export const disableTechnician = asyncHandler(async (req: Request, res: Response) => {
  const technician = await Technician.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
  if (!technician) throw ApiError.notFound('Technician not found');
  return ok(res, technician, 'Technician disabled');
});

export const technicianWorkload = asyncHandler(async (req: Request, res: Response) => {
  const technician = await Technician.findById(req.params.id);
  if (!technician) throw ApiError.notFound('Technician not found');

  const [pending, completed] = await Promise.all([
    ServiceBooking.countDocuments({ assignedTechnician: technician._id, status: { $nin: ['completed', 'cancelled'] } }),
    ServiceBooking.countDocuments({ assignedTechnician: technician._id, status: 'completed' })
  ]);

  return ok(res, { technician, pendingJobs: pending, completedJobs: completed });
});
