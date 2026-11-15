import { Types } from 'mongoose';
import { Notification, NotificationType } from '../models/Notification';
import { sendEmail, escapeHtml } from './emailService';
import { inBackground } from '../utils/background';
import { sendSms, sendWhatsApp } from './messagingService';
import { sendPushToUser } from './pushService';

interface NotifyParams {
  userId?: Types.ObjectId | string | null;
  type: NotificationType;
  title: string;
  message: string;
  email?: string;
  emailHtml?: string;
  phone?: string;
  relatedEntity?: string;
  relatedEntityId?: Types.ObjectId | string;
}

export async function notify(params: NotifyParams) {
  await Notification.create({
    user: params.userId || null,
    type: params.type,
    title: params.title,
    message: params.message,
    relatedEntity: params.relatedEntity,
    relatedEntityId: params.relatedEntityId
  });

  // Phone alert (Firebase push) for the signed-in app. Best-effort, in the background.
  if (params.userId) {
    const userId = params.userId;
    inBackground('push notification', () =>
      sendPushToUser(userId, {
        title: params.title,
        body: params.message,
        data: {
          type: params.type,
          ...(params.relatedEntity ? { relatedEntity: params.relatedEntity } : {}),
          ...(params.relatedEntityId ? { relatedEntityId: String(params.relatedEntityId) } : {})
        }
      })
    );
  }

  // The in-app notification above is the source of truth. Email/SMS/WhatsApp are best-effort and run in the
  // background so a slow or unreachable mail server can never delay (or fail) the request that triggered them.
  if (params.email) {
    const to = params.email;
    inBackground('notification email', () =>
      sendEmail(to, params.title, params.emailHtml || `<p>${escapeHtml(params.message)}</p>`)
    );
  }
  if (params.phone) {
    const phone = params.phone;
    inBackground('notification SMS/WhatsApp', async () => {
      await sendSms(phone, params.message);
      await sendWhatsApp(phone, params.message);
    });
  }
}
