import { Router } from 'express';
import {
  forgotPassword,
  validateResetToken,
  resetPassword,
} from '../controllers/passwordReset.controller';
// import { forgotPasswordRateLimiter, resetPasswordRateLimiter } from '../middleware/rateLimit.auth'; // DISABLED FOR DEV

const router = Router();

// Public routes
router.post('/forgot-password', forgotPassword); // Rate limiter removed for dev
router.get('/reset-password/validate', validateResetToken);
router.post('/reset-password', resetPassword); // Rate limiter removed for dev

export default router;

