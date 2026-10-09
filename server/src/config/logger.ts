import pino from 'pino';
import pretty from 'pino-pretty';
import { env } from './env';

const isTest = env.nodeEnv === 'test' || process.env.NODE_ENV === 'test';
const isProduction = env.nodeEnv === 'production';

/**
 * LOG_FORMAT=pretty (default) -> one readable line per event, e.g.
 *   2026-10-08 16:00:09 WARN  POST /api/auth/login 401 - 3962ms  [ddf8eef8] ip=1.2.3.4
 * LOG_FORMAT=json             -> raw JSON, for shipping to a log aggregator (Datadog, Loki, ...).
 * Colours are on for local terminals only (Render's log viewer shows escape codes as junk); override with LOG_COLOR=true|false.
 */
const useJson = process.env.LOG_FORMAT === 'json';
const useColor = process.env.LOG_COLOR ? process.env.LOG_COLOR === 'true' : !isProduction && Boolean(process.stdout.isTTY);

/** Fields that must never reach a log line. Exported so the tests exercise the exact list the app uses. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.refreshToken',
  '*.accessToken',
  '*.token',
  '*.otp',
  '*.authorization'
];

// These are already part of the readable line (or are noise in it), so the pretty printer hides them.
// They are still present in LOG_FORMAT=json output.
const HIDDEN_IN_PRETTY = 'pid,hostname,req,res,requestId,method,route,statusCode,responseTime,ip';

/** "GET /api/orders 200 - 703ms  [f84218a1] ip=1.2.3.4" : the message plus a short request id (and the IP on failures). */
function formatLine(log: Record<string, unknown>, messageKey: string): string {
  const msg = String(log[messageKey] ?? '');
  const rid = typeof log.requestId === 'string' ? log.requestId.slice(0, 8) : '';
  const status = Number(log.statusCode) || 0;
  const ip = typeof log.ip === 'string' && status >= 400 ? ` ip=${log.ip}` : '';
  return rid ? `${msg}  [${rid}]${ip}` : msg;
}

function buildDestination() {
  if (useJson || isTest) return undefined;
  return pretty({
    colorize: useColor,
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    ignore: HIDDEN_IN_PRETTY,
    messageFormat: formatLine,
    singleLine: false, // extra fields (to, subject, err...) go on indented lines under the message
    sync: true
  });
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
    timestamp: pino.stdTimeFunctions.isoTime,
    // Never write credentials to logs. Applies to every logger call, including pino-http's request/response.
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    formatters: {
      level(label) {
        return { level: label };
      }
    }
  },
  buildDestination()
);

export default logger;
