import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, paginationMeta } from '../utils/apiResponse';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const filter: Record<string, unknown> = {};
  if (req.query.module) filter.module = req.query.module;
  if (req.query.userId) filter.user = req.query.userId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('user', 'name email role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter)
  ]);
  return ok(res, items, 'Audit logs fetched', paginationMeta(page, limit, total));
});
