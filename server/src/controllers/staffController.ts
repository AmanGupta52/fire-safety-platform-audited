import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { Permission } from '../config/permissions';
import { sendEmail } from '../services/emailService';
import { writeAuditLog } from '../services/auditService';

export const listStaff = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await User.find({ role: { $ne: 'customer' } }).select('-password').sort({ createdAt: -1 });
  return ok(res, staff);
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, permissionOverrides } = req.body as {
    name: string; email: string; role: string; permissionOverrides?: Permission[];
  };

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const tempPassword = crypto.randomBytes(6).toString('hex');
  const staff = await User.create({
    name, email, password: tempPassword, role, permissionOverrides: permissionOverrides || [], isEmailVerified: true
  });

  await sendEmail(
    email,
    'Your staff account has been created',
    `<p>Hi ${name}, your account role is <b>${role}</b>. Temporary password: <b>${tempPassword}</b>. Please log in and change it.</p>`
  );

  await writeAuditLog(req, 'create', 'staff', 'User', staff._id, null, { name, email, role });
  return created(res, { id: staff._id, name, email, role }, 'Staff account created; credentials emailed');
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await User.findOne({ _id: req.params.id, role: { $ne: 'customer' } });
  if (!staff) throw ApiError.notFound('Staff member not found');
  const previous = staff.toObject();

  const editable = ['name', 'role', 'permissionOverrides', 'isActive'];
  for (const key of editable) {
    if (req.body[key] !== undefined) (staff as any)[key] = req.body[key];
  }
  await staff.save();

  await writeAuditLog(req, 'update', 'staff', 'User', staff._id, previous, staff.toObject());
  return ok(res, staff, 'Staff member updated');
});
