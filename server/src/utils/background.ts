import { logger } from '../config/logger';

/**
 * Runs a task without making the caller wait for it, and makes sure a failure is logged instead of becoming an
 * unhandled rejection. For best-effort side effects (emails, SMS) that must never delay or fail an HTTP response.
 */
export function inBackground(label: string, task: () => Promise<unknown>): void {
  const onError = (err: unknown) => logger.error({ err }, `[background] ${label} failed`);
  try {
    void task().catch(onError);
  } catch (err) {
    onError(err);
  }
}
