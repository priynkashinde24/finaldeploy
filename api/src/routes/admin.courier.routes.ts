import { Router } from 'express';
import {
  createCourier,
  getCouriers,
  updateCourier,
  createCourierRule,
  getCourierRules,
  updateCourierRule,
  assignCourierToOrder,
} from '../controllers/adminCourier.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// Couriers
// POST /api/admin/couriers - Create courier
router.post('/couriers', createCourier);

// GET /api/admin/couriers - Get couriers
router.get('/couriers', getCouriers);

// PATCH /api/admin/couriers/:id - Update courier
router.patch('/couriers/:id', updateCourier);

// Courier Rules
// POST /api/admin/courier-rules - Create courier rule
router.post('/courier-rules', createCourierRule);

// GET /api/admin/courier-rules - Get courier rules
router.get('/courier-rules', getCourierRules);

// PATCH /api/admin/courier-rules/:id - Update courier rule
router.patch('/courier-rules/:id', updateCourierRule);

// Order Courier Assignment
// PATCH /api/admin/orders/:id/assign-courier - Manually assign courier to order
router.patch('/orders/:id/assign-courier', assignCourierToOrder);

export default router;

