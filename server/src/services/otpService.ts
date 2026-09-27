import crypto from 'crypto';
import { env } from '../config/env';

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/**
 * Generates a cryptographically random 6-digit numeric OTP (000000-999999, zero-padded).
 * crypto.randomInt is used instead of Math.random() because it is not predictable/seedable.
 */
export function generateOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

/**
 * OTPs are hashed before storage (HMAC-SHA256 with a server-side secret) so that a database
 * read/leak never exposes a usable code. HMAC (not plain SHA-256) so the hash can't be
 * reproduced without the secret, even though the input space is small (10^6 codes).
 */
export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', env.jwtSecret).update(otp).digest('hex');
}

export function otpMatches(otp: string, hash: string): boolean {
  const candidate = hashOtp(otp);
  // Constant-time comparison to avoid leaking timing information about how many
  // leading characters matched.
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function otpExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

export function secondsUntilResendAllowed(lastSentAt?: Date | null): number {
  if (!lastSentAt) return 0;
  const elapsedMs = Date.now() - lastSentAt.getTime();
  const remainingMs = OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}
