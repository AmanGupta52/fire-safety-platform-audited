import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    maxConcurrency: 1,
    pool: 'forks',
    forks: {
      singleFork: true
    },
    include: ['tests/**/*.test.ts'],
    // Set BEFORE any application code is imported. The app loads server/.env on startup (dotenv never
    // overrides a variable that is already set, even to an empty string), so every value below wins over
    // a developer's real .env. This is what stops the tests from sending real emails, uploading to the real
    // Cloudinary account, or touching the real database.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/fire-safety-test-suite',
      JWT_SECRET: 'test_jwt_secret_12345678901234567890',
      JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_12345678901234567890',
      AUDIT_HMAC_SECRET: 'test_audit_hmac_secret_12345678901234567890',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      EMAIL_MODE: 'development',
      EMAIL_HOST: '',
      EMAIL_USER: '',
      EMAIL_PASSWORD: '',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
      PAYMENT_MODE: 'mock',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
      SMS_MODE: 'mock',
      WHATSAPP_MODE: 'mock',
      SENTRY_DSN: '',
      LOG_LEVEL: 'silent'
    }
  }
});
