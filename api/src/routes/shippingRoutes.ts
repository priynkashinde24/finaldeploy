import { Router } from 'express';
import {
  createLabel,
  getShippingByOrderId,
  getShippingRates,
  getAllShipments,
} from '../controllers/shippingController';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// POST /api/shipping/create-label - Create shipping label (supplier or admin)
router.post('/create-label', authenticate, authorize(['supplier', 'admin']), createLabel);

// GET /api/shipping/rates/:orderId - Get shipping rates for an order (authenticated users)
router.get('/rates/:orderId', authenticate, getShippingRates);

// GET /api/shipping/:orderId - Get shipping details by order ID (authenticated users)
router.get('/:orderId', authenticate, getShippingByOrderId);

// GET /api/shipping - Get all shipments (admin only)
router.get('/', authenticate, authorize(['admin']), getAllShipments);

export default router;

