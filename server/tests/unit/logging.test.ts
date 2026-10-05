import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { Writable } from 'stream';
import { REDACT_PATHS } from '../../src/config/logger';

/** Same redact list the app logger uses, writing to memory so the output can be inspected. */
function capture() {
  let buf = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buf += chunk.toString();
      cb();
    }
  });
  const log = pino({ level: 'info', redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { out: () => buf, log };
}

describe('log redaction', () => {
  it('never writes bearer tokens, cookies, API keys or passwords', () => {
    const { out, log } = capture();
    log.info(
      {
        req: { headers: { authorization: 'Bearer eyJSECRET', cookie: 'sid=abc', 'x-api-key': 'key-123' } },
        body: { password: 'hunter2', refreshToken: 'rt-secret', otp: '987654' }
      },
      'request'
    );
    const written = out();
    for (const secret of ['eyJSECRET', 'sid=abc', 'key-123', 'hunter2', 'rt-secret', '987654']) {
      expect(written).not.toContain(secret);
    }
    expect(written).toContain('[REDACTED]');
  });

  it('keeps non-sensitive fields readable', () => {
    const { out, log } = capture();
    log.info({ req: { method: 'GET', url: '/api/products' } }, 'ok');
    expect(out()).toContain('/api/products');
  });
});
