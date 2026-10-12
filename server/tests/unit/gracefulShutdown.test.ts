import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';
import { createShutdown } from '../../src/utils/gracefulShutdown';

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** A stand-in for http.Server whose close() callback fires only when the test says in-flight work is done. */
function fakeServer() {
  let finish: ((err?: Error) => void) | undefined;
  const server = {
    close: vi.fn((cb: (err?: Error) => void) => { finish = cb; }),
    closeIdleConnections: vi.fn()
  };
  return { server: server as unknown as Server, raw: server, finishInFlight: (err?: Error) => finish?.(err) };
}

describe('graceful shutdown', () => {
  beforeEach(() => { vi.useFakeTimers(); Object.values(silentLogger).forEach((f) => f.mockClear()); });
  afterEach(() => vi.useRealTimers());

  it('stops accepting connections, waits for in-flight requests, closes the database, then exits with the given code', async () => {
    const { server, raw, finishInFlight } = fakeServer();
    const order: string[] = [];
    const closeDatabase = vi.fn(async () => { order.push('db'); });
    const exit = vi.fn((code: number) => { order.push(`exit:${code}`); });
    const shutdown = createShutdown({ getServer: () => server, closeDatabase, exit, logger: silentLogger });

    shutdown('SIGTERM', 0);
    expect(raw.close).toHaveBeenCalledTimes(1);
    expect(raw.closeIdleConnections).toHaveBeenCalled();
    // A request is still running: nothing may be closed or exited yet.
    expect(closeDatabase).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();

    finishInFlight();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['db', 'exit:0']);
  });

  it('exits non-zero for an uncaught exception', async () => {
    const { server, finishInFlight } = fakeServer();
    const exit = vi.fn();
    const shutdown = createShutdown({ getServer: () => server, closeDatabase: async () => undefined, exit, logger: silentLogger });
    shutdown('uncaughtException', 1);
    finishInFlight();
    await vi.advanceTimersByTimeAsync(0);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('forces the exit after the timeout when a request never finishes', async () => {
    const { server } = fakeServer(); // close() callback is never invoked
    const exit = vi.fn();
    const closeDatabase = vi.fn(async () => undefined);
    const shutdown = createShutdown({ getServer: () => server, closeDatabase, exit, forceExitAfterMs: 10_000, logger: silentLogger });
    shutdown('SIGTERM', 0);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1); // a forced exit is never reported as a clean 0
  });

  it('still exits when closing the database fails', async () => {
    const { server, finishInFlight } = fakeServer();
    const exit = vi.fn();
    const shutdown = createShutdown({ getServer: () => server, closeDatabase: async () => { throw new Error('boom'); }, exit, logger: silentLogger });
    shutdown('SIGINT', 0);
    finishInFlight();
    await vi.advanceTimersByTimeAsync(0);
    expect(exit).toHaveBeenCalledWith(0);
    expect(silentLogger.error).toHaveBeenCalled();
  });

  it('a second signal while shutting down is ignored', () => {
    const { server, raw } = fakeServer();
    const shutdown = createShutdown({ getServer: () => server, closeDatabase: async () => undefined, exit: vi.fn(), logger: silentLogger });
    shutdown('SIGTERM', 0);
    shutdown('SIGINT', 0);
    expect(raw.close).toHaveBeenCalledTimes(1);
  });

  it('works before the HTTP server exists (stops during startup)', async () => {
    const closeDatabase = vi.fn(async () => undefined);
    const exit = vi.fn();
    createShutdown({ getServer: () => undefined, closeDatabase, exit, logger: silentLogger })('SIGTERM', 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(closeDatabase).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });
});
