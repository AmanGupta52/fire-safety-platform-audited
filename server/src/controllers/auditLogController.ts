import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { ok, paginationMeta } from '../utils/apiResponse';
import { verifyAuditChain } from '../services/auditService';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
  const filter: Record<string, unknown> = {};
  if (req.query.module) filter.module = req.query.module;
  if (req.query.userId) filter.user = req.query.userId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter)
  ]);
  return ok(res, items, 'Audit logs fetched', paginationMeta(page, limit, total));
});

export const verifyAuditLogChain = asyncHandler(async (_req: Request, res: Response) => {
  const result = await verifyAuditChain();
  return ok(res, result, result.isValid ? 'Audit log chain verified and untampered' : 'Audit log integrity violation detected');
});
