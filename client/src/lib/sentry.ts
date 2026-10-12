import type * as SentryModule from '@sentry/react';

// Sentry is loaded with a dynamic import so its ~80 KB stays out of the initial bundle: the app starts first and
// error reporting switches on a moment later (and not at all when VITE_SENTRY_DSN is empty).
let sentryReady: Promise<typeof SentryModule> | null = null;

/** Reads a 0..1 sample rate from an env var, falling back to a safe default when missing or invalid. */
function rate(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

// Keys whose values must never leave the browser.
const SENSITIVE = /password|token|secret|authorization|otp|signature|phone|email|address|gst/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE.test(k) ? '[Filtered]' : scrub(v, depth + 1);
  }
  return out;
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  sentryReady = import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // This app handles customer names, phone numbers, addresses and signatures. Sentry does not send personal
      // data unless asked to, so the default is left alone; the replay masking and beforeSend scrubbing below
      // cover the rest.
      integrations: [
        Sentry.browserTracingIntegration(),
        // Session replay records the screen. Mask all text and block media so personal data is never captured.
        Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })
      ],
      // Performance traces are expensive at 100%. 10% in production is plenty; override with the env vars below.
      tracesSampleRate: rate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, import.meta.env.PROD ? 0.1 : 1),
      replaysSessionSampleRate: rate(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_RATE, 0),
      replaysOnErrorSampleRate: rate(import.meta.env.VITE_SENTRY_REPLAYS_ERROR_RATE, 0.5),
      beforeSend(event) {
        if (event.request?.headers) delete (event.request.headers as Record<string, unknown>).Authorization;
        if (event.request?.data) event.request.data = scrub(event.request.data);
        if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
        return event;
      }
    });
    return Sentry;
  });
}

/** Reports an error to Sentry if it is enabled; does nothing otherwise. Never throws. */
export function captureError(error: unknown, extra?: Record<string, unknown>): void {
  sentryReady?.then((Sentry) => { Sentry.captureException(error, { extra }); }).catch(() => undefined);
}
