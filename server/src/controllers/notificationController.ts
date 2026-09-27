import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';

export const myNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await Notification.find({ user: req.user!.id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ user: req.user!.id, isRead: false });
  return ok(res, { notifications, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, { isRead: true });
  return ok(res, {}, 'Marked as read');
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ user: req.user!.id, isRead: false }, { isRead: true });
  return ok(res, {}, 'All notifications marked as read');
});
