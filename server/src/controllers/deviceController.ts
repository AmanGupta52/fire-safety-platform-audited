import { Request, Response } from 'express';
import { DeviceToken } from '../models/DeviceToken';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, fail } from '../utils/apiResponse';

export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body?.token || '').trim();
  const platform = ['android', 'ios', 'web'].includes(req.body?.platform) ? req.body.platform : 'android';
  if (token.length < 20 || token.length > 4096) return fail(res, 'Invalid device token', 400);
  // A phone belongs to whoever signed in last: moving the token covers shared phones.
  await DeviceToken.findOneAndUpdate({ token }, { user: req.user!.id, platform, lastSeenAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return ok(res, {}, 'Device registered');
});

export const unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body?.token || '').trim();
  if (token) await DeviceToken.deleteOne({ token, user: req.user!.id });
  return ok(res, {}, 'Device removed');
});
