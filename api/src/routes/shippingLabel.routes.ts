import { Router } from 'express';
import {
  generateLabel,
  downloadLabel,
  getLabelForOrder,
} from '../controllers/shippingLabel.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Generate shipping label for an order
// POST /api/orders/:id/shipping-label
router.post('/orders/:id/shipping-label', generateLabel);

// Get shipping label for an order
// GET /api/orders/:id/shipping-label
router.get('/orders/:id/shipping-label', getLabelForOrder);

// Download shipping label PDF
// GET /api/shipping-labels/:id/download
router.get('/shipping-labels/:id/download', downloadLabel);

export default router;

