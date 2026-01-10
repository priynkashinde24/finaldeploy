import { Router } from 'express';
import { updateDeliveryStatus, getDeliveryStatus } from '../controllers/deliveryPartner.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// Delivery status webhook (public, verified by API key)
router.post('/status/update', updateDeliveryStatus);

// Delivery status routes (require auth and store)
router.get('/status/:orderId', authenticate, resolveStore, getDeliveryStatus);

export default router;

