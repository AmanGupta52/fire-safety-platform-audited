import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { RefreshToken, RefreshRevokeReason } from '../models/RefreshToken';
import { User } from '../models/User';
import { ApiError } from './ApiError';
import { parseDurationMs } from './duration';

export interface JwtPayload {
  userId: string;
  role: string;
  permissions?: string[];
  /** Issued-at (seconds), added by jsonwebtoken. Used to reject tokens older than a password change. */
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  jti?: string;
}

/**
 * If two requests present the same refresh token within this window (two browser tabs refreshing at once),
 * the second one is simply told to retry instead of being treated as token theft.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

const DEFAULT_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Single source of truth for refresh lifetime: the same env value signs the JWT and sets the DB expiry. */
export function refreshTtlMs(): number {
  return parseDurationMs(env.jwtRefreshExpiresIn, DEFAULT_REFRESH_TTL_MS);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: Math.floor(refreshTtlMs() / 1000) } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}

/**
 * Filter that selects the sessions of ONE login. Sessions created before token families existed have no family;
 * for those only the single row is touched. (Filtering on `{ family: undefined }` would match every legacy row
 * in the collection and sign everybody out.)
 */
function sameLoginFilter(session: { _id: unknown; family?: string }) {
  return session.family ? { family: session.family, isRevoked: false } : { _id: session._id, isRevoked: false };
}

function newRefreshToken(userId: string): { token: string; hash: string } {
  const token = signRefreshToken({ userId, jti: crypto.randomBytes(16).toString('hex') });
  return { token, hash: hashToken(token) };
}

/**
 * Starts a new login session (a new token family). Only the SHA-256 hash is stored; the plaintext token goes
 * to the client once.
 */
export async function createRefreshTokenSession(
  userId: Types.ObjectId | string,
  ipAddress?: string,
  userAgent?: string,
  family: string = crypto.randomBytes(12).toString('hex')
): Promise<string> {
  const uid = String(userId);
  const { token, hash } = newRefreshToken(uid);

  await RefreshToken.create({
    user: new Types.ObjectId(uid),
    family,
    tokenHash: hash,
    ipAddress,
    userAgent,
    expiresAt: new Date(Date.now() + refreshTtlMs()),
    isRevoked: false
  });

  return token;
}

/**
 * Rotates a refresh token.
 *
 * - The old token is claimed with ONE atomic conditional update (isRevoked:false -> true). If two requests
 *   race, exactly one wins; the loser can never also mint a valid token.
 * - A token that was already rotated is only treated as theft if it is replayed after the grace window,
 *   and then only that login's family is revoked (other devices stay signed in).
 * - A token revoked for any other reason (logout, password change, ...) is just rejected.
 */
export async function rotateRefreshTokenSession(
  oldToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(oldToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const oldHash = hashToken(oldToken);
  const existing = await RefreshToken.findOne({ tokenHash: oldHash });
  if (!existing) throw ApiError.unauthorized('Session not found or expired. Please sign in again.');

  if (existing.isRevoked) {
    if (existing.revokedReason === 'rotated') {
      const age = Date.now() - (existing.revokedAt?.getTime() ?? 0);
      if (age <= REFRESH_REUSE_GRACE_MS) {
        throw ApiError.unauthorized('Token was just refreshed. Retry with the newest token.');
      }
      await RefreshToken.updateMany(sameLoginFilter(existing), {
        $set: { isRevoked: true, revokedAt: new Date(), revokedReason: 'reuse_detected' }
      });
      throw ApiError.unauthorized('Security alert: this session was used twice and has been ended. Please sign in again.');
    }
    throw ApiError.unauthorized('Session ended. Please sign in again.');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await RefreshToken.updateOne({ _id: existing._id }, { $set: { isRevoked: true, revokedAt: new Date(), revokedReason: 'expired' } });
    throw ApiError.unauthorized('Refresh token has expired');
  }

  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    await RefreshToken.updateMany(sameLoginFilter(existing), {
      $set: { isRevoked: true, revokedAt: new Date(), revokedReason: 'account_disabled' }
    });
    throw ApiError.unauthorized('Account not found or disabled');
  }

  const next = newRefreshToken(String(user._id));

  // Atomic claim of the old token.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: existing._id, isRevoked: false },
    { $set: { isRevoked: true, revokedAt: new Date(), revokedReason: 'rotated', replacedByTokenHash: next.hash } }
  );
  if (!claimed) {
    throw ApiError.unauthorized('Token was just refreshed. Retry with the newest token.');
  }

  await RefreshToken.create({
    user: user._id,
    family: existing.family || crypto.randomBytes(12).toString('hex'),
    tokenHash: next.hash,
    ipAddress,
    userAgent,
    expiresAt: new Date(Date.now() + refreshTtlMs()),
    isRevoked: false
  });

  const accessToken = signAccessToken({
    userId: String(user._id),
    role: user.role,
    permissions: user.effectivePermissions()
  });

  return { accessToken, refreshToken: next.token, userId: String(user._id) };
}

/**
 * Ends the login (whole token family) that this refresh token belongs to. Returns the user id if the token
 * matched a session, so callers can audit the logout.
 */
export async function revokeRefreshTokenSession(
  token: string,
  reason: RefreshRevokeReason = 'logout'
): Promise<string | null> {
  const session = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!session) return null;
  await RefreshToken.updateMany(sameLoginFilter(session), {
    $set: { isRevoked: true, revokedAt: new Date(), revokedReason: reason }
  });
  return String(session.user);
}

/** Revokes every session of a user (password change/reset, account disabled, admin action). */
export async function revokeAllUserSessions(
  userId: Types.ObjectId | string,
  reason: RefreshRevokeReason = 'password_change'
): Promise<void> {
  await RefreshToken.updateMany(
    { user: new Types.ObjectId(String(userId)), isRevoked: false },
    { $set: { isRevoked: true, revokedAt: new Date(), revokedReason: reason } }
  );
}
