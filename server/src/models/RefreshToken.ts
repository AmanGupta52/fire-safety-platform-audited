import { Schema, model, Document, Types } from 'mongoose';

export type RefreshRevokeReason = 'rotated' | 'logout' | 'reuse_detected' | 'password_change' | 'account_disabled' | 'admin' | 'expired';

export interface IRefreshToken extends Document {
  user: Types.ObjectId;
  /** All tokens that descend from one login share a family, so theft of one can end just that login chain. */
  family: string;
  tokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: RefreshRevokeReason;
  replacedByTokenHash?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    family: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    replacedByTokenHash: { type: String },
    // TTL index: MongoDB removes the document once expiresAt has passed.
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

// "Active sessions for a user" lookups.
refreshTokenSchema.index({ user: 1, isRevoked: 1 });

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
