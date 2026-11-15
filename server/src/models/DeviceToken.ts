import { Schema, model, Document, Types } from 'mongoose';

/** One phone (Firebase push token) belonging to one signed-in user. */
export interface IDeviceToken extends Document {
  user: Types.ObjectId;
  token: string;
  platform: 'android' | 'ios' | 'web';
  lastSeenAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const DeviceToken = model<IDeviceToken>('DeviceToken', deviceTokenSchema);
