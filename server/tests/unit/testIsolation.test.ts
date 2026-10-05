import { describe, it, expect } from 'vitest';
import { assertSafeTestDatabase } from '../setup';
import { env } from '../../src/config/env';

describe('the test environment cannot touch real services or real data', () => {
  it('uses test secrets and has mail, Cloudinary, payments and Sentry switched off, whatever server/.env says', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(env.jwtSecret).toMatch(/^test_/);
    expect(env.jwtRefreshSecret).toMatch(/^test_/);
    expect(process.env.CLOUDINARY_CLOUD_NAME).toBe('');
    expect(process.env.EMAIL_HOST).toBe('');
    expect(process.env.SENTRY_DSN).toBe('');
    expect(process.env.RAZORPAY_KEY_ID).toBe('');
    expect(process.env.PAYMENT_MODE).toBe('mock');
  });

  it('the database used by the suite is a dedicated test database', () => {
    expect(env.mongodbUri.toLowerCase()).toContain('test');
  });

  it('refuses to run against a database whose name does not contain "test" (the suite deletes data)', () => {
    for (const bad of ['mongodb://localhost:27017/fire-safety-platform', 'mongodb+srv://u:p@cluster.mongodb.net/production?retryWrites=true', 'mongodb://h/prod']) {
      expect(() => assertSafeTestDatabase(bad), bad).toThrow(/Refusing to run tests/);
    }
    for (const good of ['mongodb://127.0.0.1:27017/fire-safety-test-suite', 'mongodb://h/app_TEST?x=1', 'mongodb://h/ci-test']) {
      expect(() => assertSafeTestDatabase(good), good).not.toThrow();
    }
  });
});
