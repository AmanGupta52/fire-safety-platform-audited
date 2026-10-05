import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import pino from 'pino';
import { Writable } from 'stream';
import { buildRequestLogger } from '../../src/middleware/requestLogger';
import { REDACT_PATHS } from '../../src/config/logger';

/** A real Express app with the real request-logging middleware, writing to memory so the lines can be inspected. */
function harness() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      for (const line of chunk.toString().split('\n').filter(Boolean)) lines.push(JSON.parse(line));
      cb();
    }
  });
  const log = pino({ level: 'info', redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  const app = express();
  app.use(buildRequestLogger(log));
  app.get('/api/things/:id', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', express.json(), (_req, res) => res.status(401).json({ ok: false }));
  app.get('/api/boom', () => { throw new Error('kaboom'); });
  return { app, lines, text: () => lines.map((l) => JSON.stringify(l)).join('\n') };
}

describe('request logging (real middleware, real requests)', () => {
  it('logs request id, method, route, status code and duration', async () => {
    const h = harness();
    await request(h.app).get('/api/things/42').set('X-Request-Id', 'trace-abc12345');
    const line = h.lines.find((l) => l.msg && String(l.msg).includes('/api/things/42'))!;
    expect(line).toMatchObject({ requestId: 'trace-abc12345', method: 'GET', route: '/api/things/42', statusCode: 200 });
    expect(typeof line.responseTime).toBe('number');
  });

  it('returns the request id to the caller and invents one when none is sent', async () => {
    const h = harness();
    const res = await request(h.app).get('/api/things/1');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses a hostile caller-supplied request id (log injection) and uses its own', async () => {
    const h = harness();
    const res = await request(h.app).get('/api/things/1').set('X-Request-Id', 'x" ,"level":60,"msg":"forged');
    expect(res.headers['x-request-id']).not.toContain('forged');
    expect(h.text()).not.toContain('"msg":"forged');
  });

  it('NEVER writes bearer tokens, cookies or credentials to the log', async () => {
    const h = harness();
    await request(h.app)
      .get('/api/things/42?token=QUERY-SECRET&email=a@b.com')
      .set('Authorization', 'Bearer eyJ-SUPER-SECRET-TOKEN')
      .set('Cookie', 'session=COOKIE-SECRET')
      .set('X-Api-Key', 'API-KEY-SECRET');
    await request(h.app).post('/api/auth/login').send({ email: 'a@b.com', password: 'PASSWORD-SECRET' });

    const written = h.text();
    for (const secret of ['eyJ-SUPER-SECRET-TOKEN', 'COOKIE-SECRET', 'API-KEY-SECRET', 'PASSWORD-SECRET', 'QUERY-SECRET']) {
      expect(written, `leaked: ${secret}`).not.toContain(secret);
    }
    expect(written).toContain('/api/things/42'); // the route itself is still logged
  });

  it('logs 4xx as warnings and 5xx as errors', async () => {
    const h = harness();
    await request(h.app).post('/api/auth/login').send({});
    await request(h.app).get('/api/boom');
    const login = h.lines.find((l) => String(l.msg).includes('/api/auth/login'))!;
    const boom = h.lines.find((l) => String(l.msg).includes('/api/boom'))!;
    expect(login.level).toBe(40);
    expect(boom.level).toBe(50);
  });
});
