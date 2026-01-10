import { Router } from 'express';
import { getCustomerOrders, getCustomerOrder } from '../controllers/customerOrders.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.get('/orders', authenticate, getCustomerOrders);
router.get('/orders/:id', authenticate, getCustomerOrder);

export default router;

