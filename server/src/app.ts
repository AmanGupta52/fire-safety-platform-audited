import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import 'express-async-errors';

import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env';
import { initSentry } from './config/sentry';
import { requestLogger } from './middleware/requestLogger';
import apiRoutes from './routes/index';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getSitemapXml } from './controllers/sitemapController';

export function createApp(): Express {
  // Initialize Sentry error monitoring
  initSentry();

  const app = express();

  // Number of reverse proxies in front of the API (set TRUST_PROXY). req.ip, the rate limiters and the audit
  // log all depend on this being right: too high lets clients spoof their IP via X-Forwarded-For, too low
  // makes every client look like the proxy.
  app.set('trust proxy', env.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: [env.clientUrl, env.adminUrl],
      credentials: true
    })
  );

  // Attach structured logging with Pino (captures requestId, method, route, statusCode, duration, errors)
  app.use(requestLogger);

  // Cap request body size to 1mb to mitigate payload flooding / DoS attacks
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Sanitize all request data (body, query params, URL params) against $-operator injection
  app.use(mongoSanitize({ replaceWith: '_' }));

  // Serves locally-stored uploads when Cloudinary isn't configured (dev-friendly fallback).
  //
  // helmet() defaults Cross-Origin-Resource-Policy to "same-origin", which makes browsers refuse to
  // render these files when the admin (:5174) or storefront (:5173) <img> tags load them from this API
  // origin. "cross-origin" is safe here because uploads are public images/PDFs anyway.
  //
  // Uploaded files are untrusted content. Their names/extensions come from verified file contents (see
  // uploadService), X-Content-Type-Options: nosniff comes from helmet, and non-PDF files also get a
  // sandboxing CSP so nothing in them can ever run scripts on the API origin. PDFs are excluded from the
  // CSP because browsers' built-in PDF viewers do not work inside a sandboxed response.
  app.use(
    '/uploads',
    express.static(path.join(__dirname, '../uploads'), {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res, filePath) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        if (!filePath.toLowerCase().endsWith('.pdf')) {
          res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; sandbox");
        }
      }
    })
  );

  // Global rate limit, plus a tighter one specifically on auth endpoints to slow brute-force attempts.
  // (Per-account lockout in the login handler is the second layer; this one is per IP.)
  // Both are skipped in the test environment so the automated suite is not throttled.
  const isTest = env.nodeEnv === 'test' || process.env.NODE_ENV === 'test';
  if (!isTest) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false
      })
    );
    app.use(
      '/api/auth',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        message: { success: false, message: 'Too many attempts, please try again later.', errors: [] }
      })
    );
  }

  app.get('/health', (_req, res) => res.json({ success: true, message: 'OK', data: { uptime: process.uptime() } }));
  app.get('/sitemap.xml', getSitemapXml);

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
