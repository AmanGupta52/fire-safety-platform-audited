import { Schema, model, Document } from 'mongoose';

/**
 * Failed-login counters. Two kinds of record exist for every email address that somebody tries to sign in with
 * (real account or not, so the behaviour never reveals which emails are registered):
 *
 *  - scope "ip_account": failures from ONE IP address against ONE email. Reaching the limit blocks only that IP
 *    for that email. A stranger guessing your password can therefore never lock YOU out when you sign in from
 *    your own network.
 *  - scope "account": failures against one email from ALL addresses combined. A much higher limit that stops a
 *    distributed guessing attack spread over many IPs.
 *
 * Keys are hashes, so the collection does not store plain email addresses or IPs.
 */
export interface ILoginThrottle extends Document {
  key: string;
  scope: 'ip_account' | 'account';
  /** Hash of the email, so every record for an address can be cleared at once (password reset). */
  emailHash: string;
  count: number;
  lastFailedAt: Date;
  lockUntil?: Date;
  /** The record is removed after this moment (TTL index), so counters never accumulate forever. */
  expiresAt: Date;
}

const loginThrottleSchema = new Schema<ILoginThrottle>({
  key: { type: String, required: true, unique: true },
  scope: { type: String, enum: ['ip_account', 'account'], required: true },
  emailHash: { type: String, required: true, index: true },
  count: { type: Number, default: 0 },
  lastFailedAt: { type: Date },
  lockUntil: { type: Date },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

export const LoginThrottle = model<ILoginThrottle>('LoginThrottle', loginThrottleSchema);
