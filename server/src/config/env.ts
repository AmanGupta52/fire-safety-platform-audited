import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Secrets that must never be allowed to silently fall back to a hardcoded default outside
// local development. If NODE_ENV=production and one of these is missing (or still equal to
// its well-known placeholder value), the app fails fast at boot instead of running with a
// secret an attacker can find in this repo's source code.
const INSECURE_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'dev_jwt_secret_change_me',
  JWT_REFRESH_SECRET: 'dev_jwt_refresh_secret_change_me'
};

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (isProduction && name in INSECURE_DEFAULTS) {
    if (!process.env[name] || process.env[name] === INSECURE_DEFAULTS[name]) {
      throw new Error(
        `[env] ${name} must be set to a strong, unique value in production (refusing to start with a missing or default secret).`
      );
    }
  }

  if (value === undefined) {
    // In development we warn instead of crashing so the app is easy to boot the first time.
    console.warn(`[env] Missing environment variable: ${name}`);
    return '';
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  mongodbUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/fire-safety-platform'),

  jwtSecret: required('JWT_SECRET', 'dev_jwt_secret_change_me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev_jwt_refresh_secret_change_me'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:5174',

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    get enabled() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    }
  },

  email: {
    mode: (process.env.EMAIL_MODE as 'development' | 'production') || 'development',
    host: process.env.EMAIL_HOST || '',
    port: Number(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'no-reply@firesafety.example'
  },

  payment: {
    mode: (process.env.PAYMENT_MODE as 'mock' | 'razorpay') || 'mock',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || ''
  },

  sms: {
    mode: (process.env.SMS_MODE as 'mock' | 'live') || 'mock',
    apiKey: process.env.SMS_API_KEY || ''
  },

  whatsapp: {
    mode: (process.env.WHATSAPP_MODE as 'mock' | 'live') || 'mock',
    apiKey: process.env.WHATSAPP_API_KEY || ''
  },

  cron: {
    refillReminder: process.env.REFILL_REMINDER_CRON || '0 9 * * *',
    amcReminder: process.env.AMC_REMINDER_CRON || '0 9 * * *',
    lowStock: process.env.LOW_STOCK_CRON || '0 8 * * *'
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@firesafety.example',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'
  }
};
