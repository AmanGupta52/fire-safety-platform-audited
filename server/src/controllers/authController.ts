import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendEmail, emailTemplates } from '../services/emailService';
import { env } from '../config/env';
import {
  generateOtp, hashOtp, otpMatches, otpExpiryDate, secondsUntilResendAllowed,
  OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS
} from '../services/otpService';

function issueTokens(user: { _id: unknown; role: string; effectivePermissions: () => string[] }) {
  const userId = String(user._id);
  const accessToken = signAccessToken({ userId, role: user.role, permissions: user.effectivePermissions() });
  const refreshToken = signRefreshToken({ userId });
  return { accessToken, refreshToken };
}

async function issueAndSendOtp(user: InstanceType<typeof User>) {
  const otp = generateOtp();
  user.emailOtpHash = hashOtp(otp);
  user.emailOtpExpiresAt = otpExpiryDate();
  user.emailOtpAttempts = 0;
  user.emailOtpLastSentAt = new Date();
  await user.save();

  await sendEmail(
    user.email,
    'Verify your email — Fire Safety Platform',
    emailTemplates.otpVerification(otp, OTP_EXPIRY_MINUTES)
  );
}

/**
 * Registration never returns login tokens. The account is created as unverified
 * (isEmailVerified: false) and cannot sign in until the OTP emailed here is confirmed
 * via /auth/verify-otp — this is the actual security boundary, not just a UI step.
 * Applies identically to individual (b2c) and business (b2b) sign-ups.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone, customerType, companyName, gstNumber } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name, email, password, phone, customerType, companyName, gstNumber, role: 'customer', isEmailVerified: false
  });

  await issueAndSendOtp(user);

  return created(res, {
    email: user.email,
    otpExpiresInMinutes: OTP_EXPIRY_MINUTES
  }, 'Account created. Enter the verification code sent to your email to activate it.');
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() })
    .select('+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +emailOtpLastSentAt');

  if (!user) throw ApiError.badRequest('No account found for this email');
  if (user.isEmailVerified) throw ApiError.badRequest('This email is already verified — you can sign in.');

  if (!user.emailOtpHash || !user.emailOtpExpiresAt) {
    throw ApiError.badRequest('No verification code is pending. Request a new one.');
  }
  if (user.emailOtpExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This verification code has expired. Request a new one.');
  }
  if (user.emailOtpAttempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest('Too many incorrect attempts. Request a new code.');
  }

  if (!otpMatches(String(otp), user.emailOtpHash)) {
    user.emailOtpAttempts += 1;
    await user.save();
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - user.emailOtpAttempts);
    throw ApiError.badRequest(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Too many incorrect attempts. Request a new code.'
    );
  }

  user.isEmailVerified = true;
  user.emailOtpHash = undefined;
  user.emailOtpExpiresAt = undefined;
  user.emailOtpAttempts = 0;
  user.emailOtpLastSentAt = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  await sendEmail(user.email, 'Welcome to Fire Safety Platform', emailTemplates.welcome(user.name));

  const tokens = issueTokens(user);
  return ok(res, {
    user: {
      id: user._id, name: user.name, email: user.email, role: user.role,
      permissions: user.effectivePermissions()
    },
    ...tokens
  }, 'Email verified — you are now signed in.');
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+emailOtpLastSentAt');
  if (!user) throw ApiError.badRequest('No account found for this email');
  if (user.isEmailVerified) throw ApiError.badRequest('This email is already verified — you can sign in.');

  const waitSeconds = secondsUntilResendAllowed(user.emailOtpLastSentAt);
  if (waitSeconds > 0) {
    throw new ApiError(429, `Please wait ${waitSeconds}s before requesting another code.`, [{ retryAfterSeconds: waitSeconds }]);
  }

  await issueAndSendOtp(user);
  return ok(res, { email: user.email, otpExpiresInMinutes: OTP_EXPIRY_MINUTES }, 'A new verification code has been sent.');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled');

  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email before signing in.', [{ code: 'EMAIL_NOT_VERIFIED', email: user.email }]);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = issueTokens(user);
  return ok(res, {
    user: {
      id: user._id, name: user.name, email: user.email, role: user.role,
      permissions: user.effectivePermissions()
    },
    ...tokens
  }, 'Login successful');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');

  const tokens = issueTokens(user);
  return ok(res, tokens, 'Token refreshed');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.notFound('User not found');
  return ok(res, {
    id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role,
    customerType: user.customerType, companyName: user.companyName, gstNumber: user.gstNumber,
    permissions: user.effectivePermissions()
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const allowed = ['name', 'phone', 'companyName', 'gstNumber'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return ok(res, user, 'Profile updated');
});

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(token: string): string {
  // Same construction as OTP hashing: HMAC keyed with a server-side secret so a DB leak alone
  // never yields a usable token, plus it's naturally constant-time-comparable via the query.
  return crypto.createHmac('sha256', env.jwtSecret).update(token).digest('hex');
}

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  // Always respond the same way to avoid leaking which emails exist.
  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashResetToken(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    await user.save();

    const resetLink = `${env.clientUrl}/reset-password?token=${resetToken}`;
    await sendEmail(user.email, 'Reset your password', emailTemplates.passwordReset(resetLink));
  }
  return ok(res, {}, 'If that email exists, a reset link has been sent');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(String(token)),
    passwordResetExpiresAt: { $gt: new Date() }
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');

  user.password = password; // pre('save') hook re-hashes it
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  await sendEmail(user.email, 'Your password was changed', emailTemplates.passwordChanged());
  return ok(res, {}, 'Password reset — you can now sign in with your new password.');
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  // Stateless JWT: logout is handled client-side by discarding tokens.
  // If refresh-token revocation storage is added later, blacklist it here.
  return ok(res, {}, 'Logged out');
});
