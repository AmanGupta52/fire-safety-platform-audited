import type { Server } from 'http';
import { logger as defaultLogger } from '../config/logger';

export interface ShutdownDeps {
  /** The running HTTP server, or undefined if the process is stopping before it started listening. */
  getServer: () => Server | undefined;
  /** Closes the database connection. */
  closeDatabase: () => Promise<void>;
  /** Ends the process (injected so tests don't actually exit). */
  exit: (code: number) => void;
  /** In-flight requests get this long to finish before the process exits anyway. */
  forceExitAfterMs?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void };
}

/**
 * Builds the shutdown routine used for SIGTERM / SIGINT / uncaughtException:
 *   stop accepting connections -> wait for in-flight requests -> close the database -> exit.
 * A forced exit after `forceExitAfterMs` guarantees a hung request or DB close can't keep the process alive.
 * Calling the returned function again while a shutdown is running does nothing.
 */
export function createShutdown({
  getServer,
  closeDatabase,
  exit,
  forceExitAfterMs = 10_000,
  logger = defaultLogger
}: ShutdownDeps) {
  let shuttingDown = false;

  return function shutdown(reason: string, exitCode: number): void {
    if (shuttingDown) {
      logger.warn({ reason }, '[server] Shutdown already in progress');
      return;
    }
    shuttingDown = true;
    logger.info({ reason }, '[server] Shutting down: no longer accepting new connections');

    const forceTimer = setTimeout(() => {
      logger.error(`[server] Shutdown did not finish within ${forceExitAfterMs / 1000}s, forcing exit`);
      exit(exitCode || 1);
    }, forceExitAfterMs);
    forceTimer.unref?.();

    const finish = async () => {
      try {
        logger.info('[server] In-flight requests finished, closing database connection');
        await closeDatabase();
        logger.info('[server] Database connection closed');
      } catch (err) {
        logger.error({ err }, '[server] Error while closing the database connection');
      }
      clearTimeout(forceTimer);
      logger.info({ exitCode }, '[server] Shutdown complete');
      exit(exitCode);
    };

    const server = getServer();
    if (!server) {
      void finish();
      return;
    }

    // close() refuses new connections and calls back once every in-flight request has completed.
    server.close((err) => {
      if (err) logger.error({ err }, '[server] Error while closing the HTTP server');
      void finish();
    });
    // Idle keep-alive sockets would otherwise hold close() open (up to the 65 s keep-alive); drop them now.
    server.closeIdleConnections?.();
  };
}
