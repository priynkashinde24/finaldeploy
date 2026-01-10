import { Router } from 'express';
import { retryPayment, getPaymentStatus } from '../controllers/paymentRecovery.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// Payment recovery routes (require auth and store)
router.post('/retry', authenticate, resolveStore, retryPayment);
router.get('/status/:orderId', authenticate, resolveStore, getPaymentStatus);

export default router;

