import { Router } from 'express';
import { getPayouts, getPayoutByOrderId } from '../controllers/payoutController';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// GET /api/payouts - Get all payouts with optional filters (admin)
router.get('/', authenticate, authorize(['admin']), getPayouts);

// GET /api/payouts/order/:orderId - Get payout by order ID (admin)
router.get('/order/:orderId', authenticate, authorize(['admin']), getPayoutByOrderId);

export default router;

