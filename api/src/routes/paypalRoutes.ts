import { Router } from 'express';
import {
  createPayPalOrder,
  getPayPalOrder,
} from '../controllers/paypalPayment.controller';
import { handlePayPalWebhook } from '../controllers/paypalWebhook.controller';
import { createRefund, getOrderRefunds } from '../controllers/paypalRefund.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// Payment order routes (require auth and store)
router.post('/create-order', authenticate, resolveStore, createPayPalOrder);
router.get('/order/:paypalOrderId', authenticate, resolveStore, getPayPalOrder);

// Refund routes (require auth and store)
router.post('/refunds/create', authenticate, resolveStore, createRefund);
router.get('/refunds/:orderId', authenticate, resolveStore, getOrderRefunds);

// Webhook route (NO auth, uses PayPal signature verification)
// Note: express.json() middleware is applied in app.ts for this route
router.post('/webhook', handlePayPalWebhook);

export default router;

