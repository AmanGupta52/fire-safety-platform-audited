import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { runEquipmentReminderScan, runAmcExpiryScan, runLowStockScan } from './reminderJob';
import { runAbandonedCartCheck, runNotificationCleanup } from './maintenanceJobs';

/** Runs one scheduled job with start/finish logging. A failing job is logged and never takes the server down. */
function schedule(name: string, expression: string, job: () => Promise<unknown>): void {
  cron.schedule(expression, async () => {
    const started = Date.now();
    logger.info(`[cron] ${name}: started`);
    try {
      const result = await job();
      logger.info({ result }, `[cron] ${name}: finished in ${Date.now() - started}ms`);
    } catch (err) {
      logger.error({ err }, `[cron] ${name}: FAILED after ${Date.now() - started}ms`);
    }
  });
}

export function registerCronJobs(): void {
  schedule('equipment refill/inspection reminders', env.cron.refillReminder, runEquipmentReminderScan);
  schedule('AMC expiry scan', env.cron.amcReminder, runAmcExpiryScan);
  schedule('low stock scan', env.cron.lowStock, runLowStockScan);
  // Fixed sensible defaults for jobs not exposed as separate env vars.
  schedule('abandoned cart check', '0 10 * * *', runAbandonedCartCheck);
  schedule('notification cleanup', '0 3 * * 0', runNotificationCleanup);

  logger.info(
    `[cron] 5 jobs registered (refill ${env.cron.refillReminder} | AMC ${env.cron.amcReminder} | stock ${env.cron.lowStock} | carts 0 10 * * * | cleanup 0 3 * * 0)`
  );
}
