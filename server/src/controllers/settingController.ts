import { Request, Response } from 'express';
import { Setting } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';

const PUBLIC_SETTING_KEYS = ['company', 'shipping', 'reminders'];

export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const setting = await Setting.findOne({ key: req.params.key });
  return ok(res, setting?.value || {});
});

// Public, read-only subset used by the storefront footer/checkout (company name, GSTIN, shipping rules, etc).
export const getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await Setting.find({ key: { $in: PUBLIC_SETTING_KEYS } });
  const result: Record<string, unknown> = {};
  for (const s of settings) result[s.key] = s.value;
  return ok(res, result);
});

export const updateSetting = asyncHandler(async (req: Request, res: Response) => {
  const previous = await Setting.findOne({ key: req.params.key });
  const updated = await Setting.findOneAndUpdate(
    { key: req.params.key },
    { value: req.body.value },
    { upsert: true, new: true }
  );

  await writeAuditLog(req, 'update', 'settings', 'Setting', req.params.key, previous?.value, req.body.value);
  return ok(res, updated, 'Setting updated');
});

export const listAllSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await Setting.find();
  return ok(res, settings);
});
