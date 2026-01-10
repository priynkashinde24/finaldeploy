import { Router } from 'express';
import { placeCODOrder } from '../controllers/codOrder.controller';
import { createPartialPrepaidCOD } from '../controllers/codPartialPrepaid.controller';
import { collectCOD, failCOD } from '../controllers/codStatus.controller';
import { createCODRefund, getCODOrderRefunds } from '../controllers/codRefund.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// COD order routes (require auth and store)
router.post('/place', authenticate, resolveStore, placeCODOrder);
router.post('/partial-prepaid', authenticate, resolveStore, createPartialPrepaidCOD);

// COD status routes (require auth and store)
router.patch('/:id/collect', authenticate, resolveStore, collectCOD);
router.patch('/:id/fail', authenticate, resolveStore, failCOD);

// COD refund routes (require auth and store)
router.post('/refunds/create', authenticate, resolveStore, createCODRefund);
router.get('/refunds/:orderId', authenticate, resolveStore, getCODOrderRefunds);

export default router;

