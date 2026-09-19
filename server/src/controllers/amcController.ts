import { Request, Response } from 'express';
import { AMCContract } from '../models/AMCContract';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { nextNumber } from '../services/numberingService';
import { notify } from '../services/notificationService';
import { writeAuditLog } from '../services/auditService';

export const myAmcContracts = asyncHandler(async (req: Request, res: Response) => {
  const contracts = await AMCContract.find({ user: req.user!.id }).sort({ createdAt: -1 });
  return ok(res, contracts);
});

export const requestAmc = asyncHandler(async (req: Request, res: Response) => {
  const { planName, equipmentIds, amount } = req.body;
  const contractNumber = await nextNumber('amc', 'AMC');

  const contract = await AMCContract.create({
    contractNumber, user: req.user!.id, planName,
    equipmentCovered: equipmentIds || [],
    startDate: new Date(), endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: 'requested', amount: amount || 0
  });

  return created(res, contract, 'AMC request submitted');
});

// ---------- Admin ----------

export const adminListAmcContracts = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const contracts = await AMCContract.find(filter).populate('user', 'name email phone').sort({ endDate: 1 });
  return ok(res, contracts);
});

export const adminCreateAmcContract = asyncHandler(async (req: Request, res: Response) => {
  const { userId, planName, equipmentIds, startDate, endDate, amount } = req.body;
  const contractNumber = await nextNumber('amc', 'AMC');

  const contract = await AMCContract.create({
    contractNumber, user: userId, planName,
    equipmentCovered: equipmentIds || [],
    startDate: new Date(startDate), endDate: new Date(endDate),
    status: 'active', amount
  });

  await writeAuditLog(req, 'create', 'amc', 'AMCContract', contract._id, null, contract.toObject());
  return created(res, contract, 'AMC contract created');
});

export const adminAssignTechnicianToAmc = asyncHandler(async (req: Request, res: Response) => {
  const { technicianId } = req.body;
  const contract = await AMCContract.findByIdAndUpdate(req.params.id, { assignedTechnician: technicianId }, { new: true });
  if (!contract) throw ApiError.notFound('AMC contract not found');
  return ok(res, contract, 'Technician assigned to AMC');
});

export const adminScheduleAmcVisit = asyncHandler(async (req: Request, res: Response) => {
  const { scheduledDate, notes } = req.body;
  const contract = await AMCContract.findById(req.params.id);
  if (!contract) throw ApiError.notFound('AMC contract not found');

  contract.visits.push({ scheduledDate: new Date(scheduledDate), notes, status: 'scheduled' } as any);
  await contract.save();
  return ok(res, contract, 'AMC visit scheduled');
});

export const adminUpdateAmcStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const contract = await AMCContract.findById(req.params.id);
  if (!contract) throw ApiError.notFound('AMC contract not found');

  contract.status = status;
  if (status === 'renewed') {
    contract.startDate = new Date();
    contract.endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  await contract.save();

  await writeAuditLog(req, 'update_status', 'amc', 'AMCContract', contract._id, null, { status });
  await notify({ userId: contract.user, type: 'amc_reminder', title: 'AMC Status Updated', message: `Your AMC contract ${contract.contractNumber} is now ${status}.` });

  return ok(res, contract, 'AMC status updated');
});
