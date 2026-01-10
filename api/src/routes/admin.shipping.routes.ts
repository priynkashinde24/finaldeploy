import { Router } from 'express';
import {
  createShippingZone,
  getShippingZones,
  updateShippingZone,
  createShippingRate,
  getShippingRates,
  updateShippingRate,
} from '../controllers/adminShipping.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// Shipping Zones
// POST /api/admin/shipping/zones - Create shipping zone
router.post('/zones', createShippingZone);

// GET /api/admin/shipping/zones - Get shipping zones
router.get('/zones', getShippingZones);

// PATCH /api/admin/shipping/zones/:id - Update shipping zone
router.patch('/zones/:id', updateShippingZone);

// Shipping Rates
// POST /api/admin/shipping/rates - Create shipping rate
router.post('/rates', createShippingRate);

// GET /api/admin/shipping/rates - Get shipping rates
router.get('/rates', getShippingRates);

// PATCH /api/admin/shipping/rates/:id - Update shipping rate
router.patch('/rates/:id', updateShippingRate);

export default router;

