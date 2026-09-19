import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().min(10).max(15).optional(),
    customerType: z.enum(['b2c', 'b2b', 'corporate']).optional(),
    companyName: z.string().optional(),
    gstNumber: z.string().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().email() }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    password: z.string().min(8)
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const refreshTokenSchema = z.object({
  body: z.object({ refreshToken: z.string().min(10) }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6, 'Enter the 6-digit code').regex(/^\d{6}$/, 'Code must be numeric')
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const resendOtpSchema = z.object({
  body: z.object({ email: z.string().email() }),
  query: z.any().optional(),
  params: z.any().optional()
});
