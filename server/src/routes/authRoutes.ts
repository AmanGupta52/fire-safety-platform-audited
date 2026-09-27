import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema,
  verifyOtpSchema, resendOtpSchema
} from '../validators/authValidators';

const router = Router();

// Extra-strict limit on resend, on top of the global /api/auth limiter in app.ts — this is the
// endpoint most exposed to abuse (someone spamming another person's inbox with codes).
const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many resend requests. Please try again later.', errors: [] }
});

// Same reasoning as resendOtpLimiter: forgot/reset-password are easy to spam at someone else's
// inbox, or to brute-force a guessed token against, so both get their own tight limiter.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many requests. Please try again later.', errors: [] }
});

router.post('/register', validate(registerSchema), authController.register);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', resendOtpLimiter, validate(resendOtpSchema), authController.resendOtp);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);
router.put('/profile', requireAuth, authController.updateProfile);

export default router;
