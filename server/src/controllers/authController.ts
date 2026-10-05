import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { LoginThrottle } from '../models/LoginThrottle';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import {
  signAccessToken,
  createRefreshTokenSession,
  rotateRefreshTokenSession,
  revokeRefreshTokenSession,
  revokeAllUserSessions
} from '../utils/jwt';
import { sendEmail, emailTemplates } from '../services/emailService';
import { env } from '../config/env';
import { writeSystemAuditLog } from '../services/auditService';
import { clientIp, clientUserAgent } from '../utils/clientIp';
import { logger } from '../config/logger';
import {
  generateOtp, hashOtp, otpMatches, otpExpiryDate, secondsUntilResendAllowed,
  OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS
} from '../services/otpService';

async function issueTokens(
  user: { _id: unknown; role: string; effectivePermissions: () => string[] },
  req?: Request
) {
  const userId = String(user._id);
  const accessToken = signAccessToken({ userId, role: user.role, permissions: user.effectivePermissions() });
  const ip = req ? clientIp(req) : undefined;
  const userAgent = req ? clientUserAgent(req) : undefined;
  const refreshToken = await createRefreshTokenSession(userId, ip, userAgent);
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

  const tokens = await issueTokens(user, req);
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

const MAX_FAILS_PER_IP = 5; // one IP address guessing one account
const MAX_FAILS_PER_ACCOUNT = 20; // all addresses combined (distributed guessing)
const LOCK_MS = 15 * 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_REMEMBERED = 20;

// One message for every failure (unknown email, wrong password, blocked) so the response never reveals whether
// an email is registered or blocked. The real owner is told by email instead.
const LOGIN_FAILED_MESSAGE = 'Invalid email or password.';

// Compared against when the email is unknown, so a miss takes about as long as a real check.
const DUMMY_HASH = bcrypt.hashSync('timing-equalisation-placeholder', 12);

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

/** Groups an IP into a coarse key (IPv4 /32, IPv6 /64) for "seen this location before" checks. */
function ipKey(ip: string): string {
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
}

function throttleKeys(email: string, ip: string) {
  const emailHash = sha256(email);
  return {
    emailHash,
    pair: sha256(`ip:${emailHash}:${ipKey(ip)}`),
    account: sha256(`account:${emailHash}`)
  };
}

type ThrottleKeys = ReturnType<typeof throttleKeys>;

/** True while this IP is blocked for this email, or the whole account is locked. */
async function isThrottled(keys: ThrottleKeys): Promise<boolean> {
  const blocked = await LoginThrottle.exists({ key: { $in: [keys.pair, keys.account] }, lockUntil: { $gt: new Date() } });
  return !!blocked;
}

/**
 * Adds one failure to a counter and reports whether THIS call is the one that tipped it over the limit.
 * Increments are atomic ($inc); the lock is set with a conditional update so only one request ever "wins" it, which
 * is what keeps the alert email and the audit entry from being produced twice.
 */
async function bumpFailure(key: string, scope: 'ip_account' | 'account', emailHash: string, limit: number): Promise<boolean> {
  const now = new Date();

  // Forget old failures once the window has passed or the previous lock has run out.
  await LoginThrottle.updateOne(
    { key, $or: [{ expiresAt: { $lte: now } }, { lockUntil: { $lte: now } }] },
    { $set: { count: 0 }, $unset: { lockUntil: 1 } }
  );

  const bump = () =>
    LoginThrottle.updateOne(
      { key },
      {
        $inc: { count: 1 },
        $set: { scope, emailHash, lastFailedAt: now, expiresAt: new Date(now.getTime() + FAILURE_WINDOW_MS) }
      },
      { upsert: true }
    );
  try {
    await bump();
  } catch (err) {
    // Two requests creating the same record at the same instant: the loser retries as a plain increment.
    if ((err as { code?: number }).code !== 11000) throw err;
    await bump();
  }

  const record = await LoginThrottle.findOne({ key }).select('count').lean();
  if (!record || record.count < limit) return false;

  const lock = await LoginThrottle.updateOne(
    { key, $or: [{ lockUntil: { $exists: false } }, { lockUntil: null }, { lockUntil: { $lte: now } }] },
    { $set: { lockUntil: new Date(now.getTime() + LOCK_MS), expiresAt: new Date(now.getTime() + LOCK_MS + FAILURE_WINDOW_MS) } }
  );
  return lock.modifiedCount === 1;
}

async function registerFailedLogin(
  user: { _id: unknown; email: string; name: string } | null,
  keys: ThrottleKeys,
  req: Request
) {
  // Unknown emails are counted too, so an attacker gains nothing by probing addresses that are not registered.
  const ipBlockedNow = await bumpFailure(keys.pair, 'ip_account', keys.emailHash, MAX_FAILS_PER_IP);
  const accountLockedNow = await bumpFailure(keys.account, 'account', keys.emailHash, MAX_FAILS_PER_ACCOUNT);
  if (!user) return;

  const ip = clientIp(req);
  try {
    if (ipBlockedNow) {
      await writeSystemAuditLog(req, 'login_blocked', 'auth', {
        userId: String(user._id), email: user.email,
        data: { scope: 'ip_account', reason: `${MAX_FAILS_PER_IP} failed attempts from one address`, minutes: LOCK_MS / 60000 }
      });
      await sendEmail(user.email, 'Security alert: repeated failed sign-ins were blocked',
        emailTemplates.ipBlocked({ name: user.name, ipAddress: ip, minutes: LOCK_MS / 60000 }));
    }
    if (accountLockedNow) {
      await writeSystemAuditLog(req, 'account_locked', 'auth', {
        userId: String(user._id), email: user.email,
        data: { scope: 'account', reason: `${MAX_FAILS_PER_ACCOUNT} failed attempts from many addresses`, minutes: LOCK_MS / 60000 }
      });
      await sendEmail(user.email, 'Security alert: your account was temporarily locked',
        emailTemplates.accountLocked({ name: user.name, ipAddress: ip, minutes: LOCK_MS / 60000 }));
    }
  } catch (err) {
    logger.error({ err }, '[auth] Failed to record or send a lockout alert');
  }
}

/** Removes every failure counter for an email address (successful sign-in, or password reset by email). */
async function clearThrottles(emailHash: string) {
  await LoginThrottle.deleteMany({ emailHash });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email).toLowerCase().trim();
  const keys = throttleKeys(normalizedEmail, clientIp(req));

  // Blocked: refuse without even looking at the password, so guessing while blocked reveals nothing. The
  // response is identical for registered and unregistered emails.
  if (await isThrottled(keys)) throw ApiError.unauthorized(LOGIN_FAILED_MESSAGE);

  const user = await User.findOne({ email: normalizedEmail }).select('+password +knownDevices +knownIps');

  if (!user) {
    await bcrypt.compare(String(password), DUMMY_HASH);
    await registerFailedLogin(null, keys, req);
    throw ApiError.unauthorized(LOGIN_FAILED_MESSAGE);
  }

  if (!(await user.comparePassword(password))) {
    await registerFailedLogin(user, keys, req);
    throw ApiError.unauthorized(LOGIN_FAILED_MESSAGE);
  }

  // Only someone who knows the password learns the account state below.
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled');

  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email before signing in.', [{ code: 'EMAIL_NOT_VERIFIED', email: user.email }]);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);
  const deviceFingerprint = crypto.createHash('sha256').update(userAgent).digest('hex');
  const locationKey = ipKey(ip);

  const isNewDevice = !(user.knownDevices || []).includes(deviceFingerprint);
  const isNewLocation = !(user.knownIps || []).includes(locationKey);
  const isFirstLogin = !user.lastLoginAt;
  const isStaff = user.role !== 'customer';

  // Alert on a new device for everyone, and on a new location too for staff (higher-value accounts).
  if (!isFirstLogin && (isNewDevice || (isStaff && isNewLocation))) {
    try {
      await sendEmail(
        user.email,
        'Security alert: new sign-in to your account',
        emailTemplates.newDeviceLogin({
          name: user.name,
          ipAddress: ip,
          userAgent,
          time: new Date().toUTCString(),
          reason: isNewDevice ? 'a device we have not seen before' : 'a new location'
        })
      );
    } catch (err) {
      logger.error({ err }, '[auth] Failed to send new-device email');
    }
  }

  const push: Record<string, unknown> = {};
  if (isNewDevice) push.knownDevices = { $each: [deviceFingerprint], $slice: -MAX_REMEMBERED };
  if (isNewLocation) push.knownIps = { $each: [locationKey], $slice: -MAX_REMEMBERED };

  await User.updateOne(
    { _id: user._id },
    {
      $set: { lastLoginIp: ip, lastLoginUserAgent: userAgent, lastLoginAt: new Date() },
      ...(Object.keys(push).length ? { $push: push } : {})
    }
  );

  // The owner proved who they are, so earlier failures no longer count against them.
  await clearThrottles(keys.emailHash);

  const tokens = await issueTokens(user, req);
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
  const result = await rotateRefreshTokenSession(refreshToken, clientIp(req), clientUserAgent(req));
  return ok(res, { accessToken: result.accessToken, refreshToken: result.refreshToken }, 'Token refreshed');
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

export function hashResetToken(token: string): string {
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

    const baseUrl = user.role !== 'customer' ? env.adminUrl : env.clientUrl;
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    await sendEmail(user.email, 'Reset your password', emailTemplates.passwordReset(resetLink));
    await writeSystemAuditLog(req, 'password_reset_requested', 'auth', { userId: String(user._id), email: user.email });
  }
  return ok(res, {}, 'If that email exists, a reset link has been sent');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(String(token)),
    passwordResetExpiresAt: { $gt: new Date() }
  }).select('+passwordResetTokenHash +passwordResetExpiresAt +role +name +email');

  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');

  user.password = password; // pre('save') hook re-hashes it
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  // Invalidate all active sessions for this account across all devices
  await revokeAllUserSessions(user._id, 'password_change');
  // Proving control of the mailbox also lifts any sign-in blocks on this address.
  await clearThrottles(sha256(user.email));

  if (user.role !== 'customer') {
    await sendEmail(user.email, 'Security Alert: Staff account password was reset', emailTemplates.staffPasswordReset(user.name));
  } else {
    await sendEmail(user.email, 'Your password was changed', emailTemplates.passwordChanged());
  }

  await writeSystemAuditLog(req, 'password_reset', 'auth', {
    userId: String(user._id),
    email: user.email,
    data: { role: user.role }
  });

  return ok(res, {}, 'Password reset — you can now sign in with your new password.');
});

/**
 * Ends the login that the supplied refresh token belongs to. The refresh token itself is the credential, so no
 * access token is required (it may already have expired). Without a token this is a harmless no-op.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await revokeRefreshTokenSession(String(refreshToken), 'logout');
  }
  return ok(res, {}, 'Logged out');
});
