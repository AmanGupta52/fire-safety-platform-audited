import { describe, it, expect, afterEach } from 'vitest';
import { env, allowedPaymentMethods, isPaymentMethodAllowed } from '../../src/config/env';

const original = {
  nodeEnv: env.nodeEnv,
  mode: env.payment.mode,
  keyId: env.payment.razorpayKeyId,
  keySecret: env.payment.razorpayKeySecret
};
afterEach(() => {
  env.nodeEnv = original.nodeEnv;
  env.payment.mode = original.mode;
  env.payment.razorpayKeyId = original.keyId;
  env.payment.razorpayKeySecret = original.keySecret;
});

describe('allowedPaymentMethods', () => {
  it('mock is allowed only in mock mode outside production', () => {
    env.payment.mode = 'mock';
    env.nodeEnv = 'test';
    expect(allowedPaymentMethods()).toEqual(['cod', 'mock']);
    env.nodeEnv = 'development';
    expect(isPaymentMethodAllowed('mock')).toBe(true);
  });

  it('mock is NEVER allowed in production, even with PAYMENT_MODE=mock', () => {
    env.payment.mode = 'mock';
    env.nodeEnv = 'production';
    expect(isPaymentMethodAllowed('mock')).toBe(false);
    expect(allowedPaymentMethods()).toEqual(['cod']);
  });

  it('mock is not allowed when the payment mode is razorpay', () => {
    env.payment.mode = 'razorpay';
    env.nodeEnv = 'development';
    expect(isPaymentMethodAllowed('mock')).toBe(false);
  });

  it('razorpay needs razorpay mode AND both keys', () => {
    env.nodeEnv = 'production';
    env.payment.mode = 'razorpay';
    env.payment.razorpayKeyId = '';
    env.payment.razorpayKeySecret = '';
    expect(isPaymentMethodAllowed('razorpay')).toBe(false);
    env.payment.razorpayKeyId = 'rzp_test_id';
    expect(isPaymentMethodAllowed('razorpay')).toBe(false);
    env.payment.razorpayKeySecret = 'secret';
    expect(isPaymentMethodAllowed('razorpay')).toBe(true);
    env.payment.mode = 'mock';
    expect(isPaymentMethodAllowed('razorpay')).toBe(false);
  });

  it('cod is always allowed, unknown values never are', () => {
    for (const mode of ['mock', 'razorpay'] as const) {
      for (const nodeEnv of ['production', 'test']) {
        env.payment.mode = mode;
        env.nodeEnv = nodeEnv;
        expect(isPaymentMethodAllowed('cod')).toBe(true);
      }
    }
    expect(isPaymentMethodAllowed('bitcoin')).toBe(false);
    expect(isPaymentMethodAllowed(undefined)).toBe(false);
    expect(isPaymentMethodAllowed({ toString: () => 'cod' })).toBe(false);
  });
});
