import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';

export async function writeAuditLog(
  req: Request,
  action: string,
  module: string,
  entity: string,
  entityId: Types.ObjectId | string,
  previousValue: unknown,
  newValue: unknown
) {
  if (!req.user) return; // system/unauthenticated actions are not audited
  await AuditLog.create({
    user: req.user.id,
    action,
    module,
    entity,
    entityId,
    previousValue,
    newValue,
    ipAddress: req.ip
  });
}
