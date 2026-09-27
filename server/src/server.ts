import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { registerCronJobs } from './jobs';
import { ensurePdfDirs } from './services/pdfService';

async function bootstrap() {
  await connectDB();
  ensurePdfDirs();

  const app = createApp();

  registerCronJobs();

  app.listen(env.port, () => {
    console.log(`[server] Fire Safety Platform API running on port ${env.port} (${env.nodeEnv})`);
    console.log(`[server] Client URL: ${env.clientUrl} | Admin URL: ${env.adminUrl}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
