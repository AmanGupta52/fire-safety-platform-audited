import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import { logger as appLogger } from '../config/logger';

// Accept a caller-supplied request id (useful for tracing across services) only if it is a short, harmless
// token. Anything else could be used to inject fake lines or huge values into the logs.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** URL without its query string: query strings can carry tokens and personal data. */
function pathOnly(url: string | undefined): string {
  return (url || '').split('?')[0];
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
    customProps: (req, res) => ({
      requestId: req.id,
      method: req.method,
      route: pathOnly((req as { originalUrl?: string }).originalUrl || req.url),
      statusCode: res.statusCode
    }),
    customSuccessMessage: (req, res, responseTime) =>
      `${req.method} ${pathOnly((req as { originalUrl?: string }).originalUrl || req.url)} ${res.statusCode} - ${responseTime}ms`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${pathOnly((req as { originalUrl?: string }).originalUrl || req.url)} ${res.statusCode} - ${err.message}`
  });
}

export const requestLogger = buildRequestLogger();

export default requestLogger;
