import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  /** Staff/customer who performed the action. Absent for unauthenticated system events (failed logins, lockouts, resets). */
  user?: Types.ObjectId;
  actorType: 'user' | 'system';
  /** Email of the actor or of the affected account, so system events stay attributable. */
  actorEmail?: string;
  action: string;
  module: string;
  entity?: string;
  entityId?: Types.ObjectId | string;
  previousValue?: unknown;
  newValue?: unknown;
  diff?: Record<string, { before: unknown; after: unknown }>;
  ipAddress?: string;
  userAgent?: string;
  /** 2 = HMAC-sealed chain entry. Entries without it predate the sealed chain ("legacy"). */
  hashVersion?: number;
  /** Position in the sealed chain: 1, 2, 3 ... with no gaps. A missing number means an entry was deleted. */
  seq?: number;
  hash: string;
  prevHash: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorType: { type: String, enum: ['user', 'system'], default: 'user' },
    actorEmail: { type: String },
    action: { type: String, required: true },
    module: { type: String, required: true, index: true },
    entity: { type: String },
    // Mixed, not ObjectId: some entities pass string identifiers (e.g. settings key "company")
    entityId: { type: Schema.Types.Mixed },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    diff: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    hashVersion: { type: Number },
    seq: { type: Number },
    hash: { type: String, required: true, index: true },
    prevHash: { type: String, required: true }
  },
  // minimize:false keeps empty objects ({}), otherwise Mongoose drops them and the stored entry would no longer
  // match the value that was sealed.
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false }
);

// Two sealed entries can never share a position in the chain. This is what makes the chain fork-proof even with
// several server instances writing at once: the loser of a race gets a duplicate-key error and retries with the
// next number. Partial, so databases that still hold older (unsealed) entries can build the index.
auditLogSchema.index({ seq: 1 }, { unique: true, partialFilterExpression: { hashVersion: 2 } });
auditLogSchema.index({ createdAt: -1 });

// Enforce append-only tamper-evident security at the Mongoose level:
// Deny any update or deletion operation on AuditLog records.
const immutableError = () => {
  throw new Error('AuditLog records are immutable and tamper-evident; modification or deletion is strictly forbidden.');
};

auditLogSchema.pre('updateOne', immutableError);
auditLogSchema.pre('updateMany', immutableError);
auditLogSchema.pre('findOneAndUpdate', immutableError);
auditLogSchema.pre('replaceOne', immutableError);
auditLogSchema.pre('deleteOne', immutableError);
auditLogSchema.pre('deleteMany', immutableError);
auditLogSchema.pre('findOneAndDelete', immutableError);
auditLogSchema.pre('findOneAndReplace', immutableError);

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

export interface ICompanySettings {
  name: string;
  companyName: string;
  logo?: string;
  favicon?: string;
  description?: string;
  phone: string;
  alternatePhone?: string;
  whatsapp?: string;
  email: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  googleMapsUrl?: string;
  businessHours?: string;
  emergencyContact?: string;
  gstin?: string;
  gstNumber?: string;
  licenseInformation?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  footerText?: string;
  copyrightText?: string;
}

export interface ISetting extends Document {
  key: string;
  value: unknown;
  updatedAt: Date;
}
const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);
export const Setting = model<ISetting>('Setting', settingSchema);