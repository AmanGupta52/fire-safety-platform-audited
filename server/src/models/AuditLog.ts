import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  action: string;
  module: string;
  entity?: string;
  entityId?: Types.ObjectId;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    module: { type: String, required: true, index: true },
    entity: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

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
