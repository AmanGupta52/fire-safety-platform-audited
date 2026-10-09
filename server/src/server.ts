import { createApp } from './app';
import { logger } from './config/logger';
import { connectDB } from './config/db';
import { env } from './config/env';
import { registerCronJobs } from './jobs';
import { ensurePdfDirs } from './services/pdfService';
import { seedServicesIfEmpty, backfillServiceBookings } from './utils/serviceSeed';

async function bootstrap() {
  await connectDB();
  ensurePdfDirs();
  await seedServicesIfEmpty();
  await backfillServiceBookings();

  const app = createApp();


  registerCronJobs();

  app.listen(env.port, () => {
    logger.info(`[server] Fire Safety Platform API running on port ${env.port} (${env.nodeEnv})`);
    logger.info(`[server] Client URL: ${env.clientUrl} | Admin URL: ${env.adminUrl}`);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, '[server] Failed to start');
  process.exit(1);
});
