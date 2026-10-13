import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { logger } from './config/logger';
import { connectDB } from './config/db';
import { env } from './config/env';
import { registerCronJobs } from './jobs';
import { ensurePdfDirs } from './services/pdfService';
import { seedServicesIfEmpty, backfillServiceBookings } from './utils/serviceSeed';
import { createShutdown } from './utils/gracefulShutdown';
import { emailConfigProblem } from './services/emailService';

// Render's proxy closes idle connections after 60 s. Node must keep sockets open LONGER than that, otherwise
// the proxy can reuse a socket Node just closed and the client sees a random 502. headersTimeout has to be
// larger than keepAliveTimeout.
const KEEP_ALIVE_TIMEOUT_MS = 65_000;
const HEADERS_TIMEOUT_MS = 66_000;
let server: http.Server | undefined;

const shutdown = createShutdown({
  getServer: () => server,
  closeDatabase: () => mongoose.connection.close(),
  exit: (code) => process.exit(code),
  forceExitAfterMs: 10_000
});

async function bootstrap() {
  await connectDB();
  ensurePdfDirs();
  await seedServicesIfEmpty();
  await backfillServiceBookings();

  const emailProblem = emailConfigProblem();
  if (emailProblem) logger.warn(`[email] ${emailProblem}`);

  const app = createApp();


  registerCronJobs();

  server = app.listen(env.port, () => {
    logger.info(`[server] Fire Safety Platform API running on port ${env.port} (${env.nodeEnv})`);
    logger.info(`[server] Client URL: ${env.clientUrl} | Admin URL: ${env.adminUrl}`);
  });
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
}

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));

process.on('unhandledRejection', (reason) => {
  // Logged, not fatal: one forgotten .catch() should not take the whole API down.
  logger.fatal({ err: reason }, '[server] Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  // After an uncaught exception the process state is unknown, so finish what is in flight and exit non-zero.
  logger.fatal({ err }, '[server] Uncaught exception');
  shutdown('uncaughtException', 1);
});

bootstrap().catch((err) => {
  logger.fatal({ err }, '[server] Failed to start');
  process.exit(1);
});
