import { Request, Response } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { Permission, PERMISSIONS, ROLE_PERMISSIONS, Role } from '../config/permissions';
import { sendEmail, emailTemplates } from '../services/emailService';
import { writeAuditLog } from '../services/auditService';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { hashResetToken } from './authController';
import { revokeAllUserSessions } from '../utils/jwt';

async function isLastSuperAdmin(staffId: Types.ObjectId | string): Promise<boolean> {
  const activeCount = await User.countDocuments({
    role: 'super_admin',
    isActive: true,
    _id: { $ne: staffId }
  });
  return activeCount === 0;
}

export const getAvailableRolesAndPermissions = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, {
    roles: ['super_admin', 'admin', 'sales', 'technician', 'accountant'],
    permissions: PERMISSIONS,
    rolePermissions: ROLE_PERMISSIONS
  });
});

export const listStaff = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await User.find({ role: { $ne: 'customer' } })
    .select('-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts -emailOtpLastSentAt -passwordResetTokenHash -passwordResetExpiresAt')
    .sort({ createdAt: -1 });
  return ok(res, staff);
});

export const getStaffById = asyncHandler(async (req: Request, res: Response) => {
  const staff = await User.findOne({ _id: req.params.id, role: { $ne: 'customer' } })
    .select('-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts -emailOtpLastSentAt -passwordResetTokenHash -passwordResetExpiresAt');

  if (!staff) {
    throw ApiError.notFound('Staff member not found');
  }

  return ok(res, staff);
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, phone, permissionOverrides, isActive } = req.body as {
    name: string;
    email: string;
    role: Role;
    phone?: string;
    permissionOverrides?: Permission[];
    isActive?: boolean;
    password?: string;
  };

  // Privilege escalation protection: only Super Admin can create another Super Admin
  if (role === 'super_admin' && req.user?.role !== 'super_admin') {
    throw ApiError.forbidden('Only Super Admin can create an account with the super_admin role');
  }

  // Permission escalation protection: cannot grant permissions you do not possess
  if (permissionOverrides && permissionOverrides.length > 0 && req.user?.role !== 'super_admin') {
    const invalidPerms = permissionOverrides.filter((p) => !req.user?.permissions?.includes(p));
    if (invalidPerms.length > 0) {
      throw ApiError.forbidden(`Cannot grant permissions you do not possess: ${invalidPerms.join(', ')}`);
    }
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  // Generate an unguessable high-entropy random password for the internal record
  const initialSecret = crypto.randomBytes(32).toString('hex');

  // Generate a secure one-time set-password token that expires in 24 hours
  const setupToken = crypto.randomBytes(32).toString('hex');
  const setupTokenHash = hashResetToken(setupToken);
  const setupTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const staff = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: initialSecret,
    phone: phone?.trim(),
    role,
    permissionOverrides: permissionOverrides || [],
    isActive: isActive !== undefined ? isActive : true,
    isEmailVerified: true,
    passwordResetTokenHash: setupTokenHash,
    passwordResetExpiresAt: setupTokenExpiresAt
  });

  const inviteEmailSent = await sendInvite(staff.name, staff.role, normalizedEmail, setupToken);

  await writeAuditLog(req, 'create', 'staff', 'User', staff._id, null, {
    name: staff.name,
    email: staff.email,
    role: staff.role,
    permissionOverrides: staff.permissionOverrides,
    isActive: staff.isActive
  });

  const staffResponse = await User.findById(staff._id).select(
    '-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts -emailOtpLastSentAt -passwordResetTokenHash -passwordResetExpiresAt'
  );

  // inviteEmailSent tells the admin whether the person actually received their link, so a delivery problem is
  // visible instead of leaving an account nobody can open.
  return created(
    res,
    { ...staffResponse!.toObject(), inviteEmailSent },
    inviteEmailSent
      ? 'Staff account created. A set-password link was emailed.'
      : 'Staff account created, but the invite email could not be sent. Use "Resend invite" once email is working.'
  );
});

/** Emails the one-time set-password link. Returns false (and logs) if the email could not be sent. */
async function sendInvite(name: string, role: string, email: string, setupToken: string): Promise<boolean> {
  try {
    await sendEmail(
      email,
      'Set your password — Fire Safety Platform Staff Account',
      emailTemplates.staffInviteSetPassword({
        name,
        role: role.replace('_', ' '),
        setPasswordLink: `${env.adminUrl}/reset-password?token=${setupToken}`,
        expiresInHours: 24
      })
    );
    return true;
  } catch (err) {
    logger.error({ err, email }, '[staff] Failed to send staff invite email');
    return false;
  }
}

/**
 * Sends a fresh set-password link to a staff member who has not set a password yet (for example because the first
 * email never arrived or the 24-hour link expired). Issuing a new link invalidates the previous one.
 */
export const resendStaffInvite = asyncHandler(async (req: Request, res: Response) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw ApiError.badRequest('Invalid staff id');
  const staff = await User.findOne({ _id: req.params.id, role: { $ne: 'customer' } });
  if (!staff) throw ApiError.notFound('Staff member not found');

  // Only a super admin may touch a super admin account.
  if (staff.role === 'super_admin' && req.user?.role !== 'super_admin') {
    throw ApiError.forbidden('Only Super Admin can manage a super_admin account');
  }
  if (staff.lastLoginAt) {
    throw ApiError.badRequest('This person has already signed in. If they forgot their password, reset it instead.');
  }

  const setupToken = crypto.randomBytes(32).toString('hex');
  staff.passwordResetTokenHash = hashResetToken(setupToken);
  staff.passwordResetExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await staff.save();

  const inviteEmailSent = await sendInvite(staff.name, staff.role, staff.email, setupToken);
  await writeAuditLog(req, 'resend_invite', 'staff', 'User', staff._id, null, { email: staff.email, inviteEmailSent });

  if (!inviteEmailSent) throw new ApiError(502, 'The invite email could not be sent. Check the email settings and try again.');
  return ok(res, { inviteEmailSent: true }, 'A new set-password link was emailed');
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await User.findOne({ _id: req.params.id, role: { $ne: 'customer' } });
  if (!staff) {
    throw ApiError.notFound('Staff member not found');
  }

  const previous = staff.toObject();

  // Privilege escalation protection: only Super Admin can modify a Super Admin
  if (staff.role === 'super_admin' && req.user?.role !== 'super_admin') {
    throw ApiError.forbidden('Only Super Admin can modify a Super Admin account');
  }

  // Self-privilege escalation protection: cannot alter own role or permissions
  if (staff._id.toString() === req.user?.id) {
    if (req.body.role && req.body.role !== staff.role) {
      throw ApiError.forbidden('You cannot change your own role');
    }
    if (req.body.permissionOverrides !== undefined) {
      throw ApiError.forbidden('You cannot modify your own permission overrides');
    }
  }

  // Prevent promoting someone to Super Admin unless caller is Super Admin
  if (req.body.role === 'super_admin' && req.user?.role !== 'super_admin') {
    throw ApiError.forbidden('Only Super Admin can promote a user to super_admin');
  }

  // Permission escalation protection: cannot grant permissions you do not possess
  if (req.body.permissionOverrides && req.user?.role !== 'super_admin') {
    const invalidPerms = (req.body.permissionOverrides as Permission[]).filter(
      (p) => !req.user?.permissions?.includes(p)
    );
    if (invalidPerms.length > 0) {
      throw ApiError.forbidden(`Cannot grant permissions you do not possess: ${invalidPerms.join(', ')}`);
    }
  }

  // Last Super Admin protection:
  if (staff.role === 'super_admin') {
    // Demoting the last super admin
    if (req.body.role && req.body.role !== 'super_admin') {
      const isLast = await isLastSuperAdmin(staff._id);
      if (isLast) {
        throw ApiError.badRequest('Cannot change role: system must maintain at least one active Super Admin');
      }
    }
    // Deactivating the last super admin
    if (req.body.isActive === false) {
      const isLast = await isLastSuperAdmin(staff._id);
      if (isLast) {
        throw ApiError.badRequest('Cannot deactivate the last active Super Admin account');
      }
    }
  }

  // Whitelist safe updates
  if (req.body.name) staff.name = String(req.body.name).trim();
  if (req.body.phone !== undefined) staff.phone = req.body.phone ? String(req.body.phone).trim() : undefined;
  if (req.body.role) staff.role = req.body.role;
  if (req.body.permissionOverrides !== undefined) staff.permissionOverrides = req.body.permissionOverrides;
  if (req.body.isActive !== undefined) staff.isActive = Boolean(req.body.isActive);

  // Email update with uniqueness check
  if (req.body.email && req.body.email.toLowerCase().trim() !== staff.email) {
    const newEmail = req.body.email.toLowerCase().trim();
    const emailConflict = await User.findOne({ email: newEmail, _id: { $ne: staff._id } });
    if (emailConflict) {
      throw ApiError.conflict('An account with this email already exists');
    }
    staff.email = newEmail;
  }

  // Password update (hashed once automatically by User pre-save hook)
  let passwordChanged = false;
  if (req.body.password && String(req.body.password).trim().length >= 8) {
    staff.password = String(req.body.password).trim();
    passwordChanged = true;
  }

  await staff.save();

  if (passwordChanged) {
    // Invalidate active sessions upon password reset/update
    await revokeAllUserSessions(staff._id);
    try {
      await sendEmail(
        staff.email,
        'Security Alert: Staff account password was reset',
        emailTemplates.staffPasswordReset(staff.name)
      );
    } catch (err) {
      logger.error({ err }, '[staff] Failed to send password reset alert email');
    }
  }

  await writeAuditLog(req, 'update', 'staff', 'User', staff._id, previous, {
    name: staff.name,
    email: staff.email,
    role: staff.role,
    permissionOverrides: staff.permissionOverrides,
    isActive: staff.isActive
  });

  const updatedStaff = await User.findById(staff._id).select(
    '-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts -emailOtpLastSentAt -passwordResetTokenHash -passwordResetExpiresAt'
  );

  return ok(res, updatedStaff, 'Staff member updated successfully');
});

export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await User.findOne({ _id: req.params.id, role: { $ne: 'customer' } });
  if (!staff) {
    throw ApiError.notFound('Staff member not found');
  }

  // Privilege escalation check
  if (staff.role === 'super_admin' && req.user?.role !== 'super_admin') {
    throw ApiError.forbidden('Only Super Admin can delete a Super Admin account');
  }

  // Last Super Admin protection
  if (staff.role === 'super_admin') {
    const isLast = await isLastSuperAdmin(staff._id);
    if (isLast) {
      throw ApiError.badRequest('Cannot delete the last active Super Admin account');
    }
  }

  const previous = staff.toObject();

  if (req.query.permanent === 'true' && req.user?.role === 'super_admin') {
    await revokeAllUserSessions(staff._id);
    await User.findByIdAndDelete(staff._id);
    await writeAuditLog(req, 'delete', 'staff', 'User', staff._id, previous, null);
    return ok(res, { id: staff._id }, 'Staff account permanently deleted');
  }

  // Safe soft deactivation
  staff.isActive = false;
  await staff.save();
  await revokeAllUserSessions(staff._id);

  await writeAuditLog(req, 'deactivate', 'staff', 'User', staff._id, previous, { isActive: false });

  return ok(res, { id: staff._id, isActive: false }, 'Staff account deactivated successfully');
});
