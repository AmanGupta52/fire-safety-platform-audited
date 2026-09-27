import { Cart } from '../models/Cart';
import { notify } from '../services/notificationService';
import { NotificationLog } from '../models/Notification';
import { Notification } from '../models/Notification';

/**
 * Flags carts that have had items sitting untouched for 48+ hours and sends a single
 * reminder per cart per day (deduped through NotificationLog like the other reminders).
 */
export async function runAbandonedCartCheck(): Promise<{ checked: number; sent: number }> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const carts = await Cart.find({ 'items.0': { $exists: true }, updatedAt: { $lte: cutoff } }).populate('user', 'name email');

  let sent = 0;
  const todayKey = new Date().toISOString().slice(0, 10);

  for (const cart of carts) {
    const user = cart.user as any;
    if (!user) continue;

    const already = await NotificationLog.findOne({
      entityType: 'equipment', entityId: `abandoned_cart:${cart._id}`, milestone: todayKey, channel: 'email'
    });
    if (already) continue;

    await notify({
      userId: user._id, type: 'order_status', title: 'Items waiting in your cart',
      message: `You have ${cart.items.length} item(s) waiting in your cart. Complete your purchase before stock runs out.`,
      email: user.email
    });

    await NotificationLog.create({
      entityType: 'equipment', entityId: `abandoned_cart:${cart._id}`, milestone: todayKey, channel: 'email', success: true
    }).catch(() => undefined);

    sent += 1;
  }

  return { checked: carts.length, sent };
}

/** Deletes read in-app notifications and dedup logs older than 90 days to keep collections lean. */
export async function runNotificationCleanup(): Promise<{ deletedNotifications: number; deletedLogs: number }> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [notifResult, logResult] = await Promise.all([
    Notification.deleteMany({ isRead: true, createdAt: { $lte: cutoff } }),
    NotificationLog.deleteMany({ sentAt: { $lte: cutoff } })
  ]);
  return { deletedNotifications: notifResult.deletedCount || 0, deletedLogs: logResult.deletedCount || 0 };
}
