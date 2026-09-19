import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Permission, Role, ROLE_PERMISSIONS } from '../config/permissions';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  permissionOverrides: Permission[];
  customerType: 'b2c' | 'b2b' | 'corporate';
  companyName?: string;
  gstNumber?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailOtpHash?: string;
  emailOtpExpiresAt?: Date;
  emailOtpAttempts: number;
  emailOtpLastSentAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  tags: string[];
  notes?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  effectivePermissions(): Permission[];
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'sales', 'technician', 'accountant', 'customer'],
      default: 'customer',
      index: true
    },
    permissionOverrides: { type: [String], default: [] },
    customerType: { type: String, enum: ['b2c', 'b2b', 'corporate'], default: 'b2c' },
    companyName: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false, index: true },
    // OTP fields: only a salted hash of the code is ever stored, never the plaintext code.
    // select:false keeps them out of every default query result (including req.user lookups)
    // so they can never accidentally leak into an API response.
    emailOtpHash: { type: String, select: false },
    emailOtpExpiresAt: { type: Date, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },
    emailOtpLastSentAt: { type: Date, select: false },
    // Same treatment as the OTP fields above: only a keyed hash of the reset token is ever
    // stored, and select:false keeps it out of every default query result.
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    tags: { type: [String], default: [] },
    notes: { type: String },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.effectivePermissions = function (): Permission[] {
  const base = ROLE_PERMISSIONS[this.role as Role] || [];
  return Array.from(new Set([...base, ...(this.permissionOverrides || [])]));
};

export const User = model<IUser>('User', userSchema);
