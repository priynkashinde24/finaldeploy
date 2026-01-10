import { Router } from 'express';
import {
  confirmOrder,
  processOrder,
  shipOrder,
  deliverOrder,
  cancelOrder,
  returnOrder,
  refundOrder,
  getAllowedTransitionsForOrder,
} from '../controllers/orderLifecycle.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * Order Lifecycle Routes
 * 
 * All routes require authentication
 */

// Order state transitions
router.patch('/orders/:id/confirm', authenticate, confirmOrder);
router.patch('/orders/:id/process', authenticate, processOrder);
router.patch('/orders/:id/ship', authenticate, shipOrder);
router.patch('/orders/:id/deliver', authenticate, deliverOrder);
router.patch('/orders/:id/cancel', authenticate, cancelOrder);
router.patch('/orders/:id/return', authenticate, returnOrder);
router.patch('/orders/:id/refund', authenticate, refundOrder);

// Get allowed transitions
router.get('/orders/:id/transitions', authenticate, getAllowedTransitionsForOrder);

export default router;

