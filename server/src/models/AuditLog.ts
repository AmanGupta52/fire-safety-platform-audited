import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  action: string;
  module: string;
  entity?: string;
  entityId?: Types.ObjectId | string;
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
    // Mixed, not ObjectId: most entities pass a real Mongo _id here, but settings audit
    // entries pass the setting's string key (e.g. "company"), which isn't castable to
    // ObjectId and previously threw a Mongoose ValidationError (surfaced to the client
    // as a 422 on PUT /settings/:key even though the setting itself had already saved).
    entityId: { type: Schema.Types.Mixed },
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