import { Types } from 'mongoose';
import { Notification, NotificationType } from '../models/Notification';
import { sendEmail } from './emailService';
import { sendSms, sendWhatsApp } from './messagingService';

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

  if (params.email) {
    await sendEmail(params.email, params.title, params.emailHtml || `<p>${params.message}</p>`);
  }
  if (params.phone) {
    await sendSms(params.phone, params.message);
    await sendWhatsApp(params.phone, params.message);
  }
}
