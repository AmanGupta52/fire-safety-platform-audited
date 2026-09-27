import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType =
  | 'order_confirmation' | 'order_status' | 'quote_created' | 'quote_approved'
  | 'service_booking' | 'service_reminder' | 'amc_reminder' | 'refill_reminder'
  | 'inspection_reminder' | 'low_stock';

export interface INotification extends Document {
  _id: Types.ObjectId;
  user?: Types.ObjectId | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntity?: string;
  relatedEntityId?: Types.ObjectId;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    relatedEntity: { type: String },
    relatedEntityId: { type: Schema.Types.ObjectId }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Notification = model<INotification>('Notification', notificationSchema);

// Deduplication log: one row per (entity, type, milestone) so the reminder cron never re-sends.
export interface INotificationLog extends Document {
  _id: Types.ObjectId;
  entityType: 'equipment' | 'amc';
  entityId: Types.ObjectId;
  milestone: string; // e.g. "30_days_before", "overdue"
  channel: 'in_app' | 'email' | 'sms' | 'whatsapp';
  sentAt: Date;
  success: boolean;
  providerResponse?: string;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    entityType: { type: String, enum: ['equipment', 'amc'], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    milestone: { type: String, required: true },
    channel: { type: String, enum: ['in_app', 'email', 'sms', 'whatsapp'], required: true },
    sentAt: { type: Date, default: Date.now },
    success: { type: Boolean, default: true },
    providerResponse: { type: String }
  }
);

notificationLogSchema.index({ entityType: 1, entityId: 1, milestone: 1, channel: 1 }, { unique: true });

export const NotificationLog = model<INotificationLog>('NotificationLog', notificationLogSchema);
