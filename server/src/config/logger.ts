import pino from 'pino';
import { env } from './env';

const isProduction = env.nodeEnv === 'production';
const isTest = env.nodeEnv === 'test' || process.env.NODE_ENV === 'test';

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

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never write credentials to logs. Applies to every logger call, including pino-http's request/response.
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  transport:
    !isProduction && !isTest
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});

export default logger;
