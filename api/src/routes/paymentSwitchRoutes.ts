import { Router } from 'express';
import { getAvailablePaymentMethods, switchPaymentMethod } from '../controllers/paymentSwitch.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// Payment switch routes (require auth and store)
router.get('/methods/:orderId', authenticate, resolveStore, getAvailablePaymentMethods);
router.post('/switch', authenticate, resolveStore, switchPaymentMethod);

export default router;

