import { Router } from 'express';
import {
  recoverCart,
  getRecoveryMetrics,
  recoveryRateLimiter,
} from '../controllers/cartRecovery.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// GET /cart/recover - Recover cart via token (public, rate-limited)
router.get('/recover', recoveryRateLimiter, recoverCart);

// GET /cart/recovery/metrics - Get recovery metrics (admin only)
router.get('/recovery/metrics', authenticate, authorize(['admin']), getRecoveryMetrics);

export default router;

