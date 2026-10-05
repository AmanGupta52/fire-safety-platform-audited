import * as Sentry from '@sentry/node';
import { env } from './env';
import { logger } from './logger';

let isInitialized = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN || '';
  if (!dsn) {
    if (env.nodeEnv === 'production') {
      logger.warn('[sentry] SENTRY_DSN is not set; error monitoring is inactive.');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: env.nodeEnv,
      tracesSampleRate: env.nodeEnv === 'production' ? 0.2 : 1.0,
      integrations: [
        // Sentry node integrations
      ]
    });
    isInitialized = true;
    logger.info('[sentry] Sentry error monitoring initialized.');
  } catch (err) {
    logger.error({ err }, '[sentry] Failed to initialize Sentry');
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (isInitialized) {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  }
}

export { Sentry };
