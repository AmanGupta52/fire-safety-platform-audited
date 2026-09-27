import cron from 'node-cron';
import { env } from '../config/env';
import { runEquipmentReminderScan, runAmcExpiryScan, runLowStockScan } from './reminderJob';
import { runAbandonedCartCheck, runNotificationCleanup } from './maintenanceJobs';

export function registerCronJobs(): void {
  cron.schedule(env.cron.refillReminder, async () => {
    console.log('[cron] Running equipment refill/inspection reminder scan...');
    const result = await runEquipmentReminderScan();
    console.log('[cron] Equipment reminder scan complete:', result);
  });

  cron.schedule(env.cron.amcReminder, async () => {
    console.log('[cron] Running AMC expiry scan...');
    const result = await runAmcExpiryScan();
    console.log('[cron] AMC expiry scan complete:', result);
  });

  cron.schedule(env.cron.lowStock, async () => {
    console.log('[cron] Running low stock scan...');
    const result = await runLowStockScan();
    console.log('[cron] Low stock scan complete:', result);
  });

  // Fixed sensible defaults for jobs not exposed as separate env vars in the spec's example.
  cron.schedule('0 10 * * *', async () => {
    console.log('[cron] Running abandoned cart check...');
    const result = await runAbandonedCartCheck();
    console.log('[cron] Abandoned cart check complete:', result);
  });

  cron.schedule('0 3 * * 0', async () => {
    console.log('[cron] Running notification cleanup...');
    const result = await runNotificationCleanup();
    console.log('[cron] Notification cleanup complete:', result);
  });

  console.log('[cron] All jobs registered:', {
    refillReminder: env.cron.refillReminder,
    amcReminder: env.cron.amcReminder,
    lowStock: env.cron.lowStock,
    abandonedCart: '0 10 * * *',
    notificationCleanup: '0 3 * * 0'
  });
}
