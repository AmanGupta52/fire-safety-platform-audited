import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Logger } from 'pino';
import { logger as appLogger } from '../config/logger';

// Accept a caller-supplied request id (useful for tracing across services) only if it is a short, harmless
// token. Anything else could be used to inject fake lines or huge values into the logs.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** URL without its query string: query strings can carry tokens and personal data. */
function pathOnly(url: string | undefined): string {
  return (url || '').split('?')[0];
}

/** The per-request fields shared by success and error log lines. */
function requestFields(req: IncomingMessage & { originalUrl?: string; ip?: string; id?: unknown }, res: ServerResponse) {
  return {
    requestId: req.id,
    method: req.method,
    route: pathOnly(req.originalUrl || req.url),
    statusCode: res.statusCode,
    // Express resolves this through "trust proxy"; the raw socket address is just the proxy (::1) on Render.
    ip: req.ip
  };
}

/** Builds the request-logging middleware around a given logger (the app logger by default; tests pass their own). */
export function buildRequestLogger(log: Logger = appLogger) {
  return pinoHttp({
    logger: log,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    // Log a small, explicit set of request fields instead of the whole request object (which includes headers).
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: pathOnly(req.originalUrl || req.url), remoteAddress: req.remoteAddress }),
      res: (res) => ({ statusCode: res.statusCode })
    },
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Skip platform health probes (Render pings /health constantly) so they don't bury real traffic.
    autoLogging: { ignore: (req) => pathOnly(req.url) === '/health' },
    // Added when the response finishes. (customProps would run at request start too, which logged every
    // field twice and recorded a stale 200 status before the real one.)
    customSuccessObject: (req, res, val) => ({ ...val, ...requestFields(req, res) }),
    // Drop pino-http's own synthetic "failed with status code 500" error: it carries a useless stack. The real
    // error (with its real stack) is logged once by errorHandler.
    customErrorObject: (req, res, _err, val) => {
      const { err: _ignored, ...rest } = val as Record<string, unknown>;
      return { ...rest, ...requestFields(req, res) };
    },
    customSuccessMessage: (req, res, responseTime) =>
      `${req.method} ${pathOnly((req as { originalUrl?: string }).originalUrl || req.url)} ${res.statusCode} - ${responseTime}ms`,
    customErrorMessage: (req, res) =>
      `${req.method} ${pathOnly((req as { originalUrl?: string }).originalUrl || req.url)} ${res.statusCode} - request failed`
  });
}

export const requestLogger = buildRequestLogger();

export default requestLogger;
