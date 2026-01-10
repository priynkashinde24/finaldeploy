import { Router } from 'express';
import {
  createReturnShippingRule,
  listReturnShippingRules,
  getReturnShippingRule,
  updateReturnShippingRule,
  deleteReturnShippingRule,
} from '../controllers/adminReturnShipping.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /api/admin/return-shipping-rules - Create return shipping rule
router.post('/', createReturnShippingRule);

// GET /api/admin/return-shipping-rules - List return shipping rules
router.get('/', listReturnShippingRules);

// GET /api/admin/return-shipping-rules/:id - Get return shipping rule
router.get('/:id', getReturnShippingRule);

// PATCH /api/admin/return-shipping-rules/:id - Update return shipping rule
router.patch('/:id', updateReturnShippingRule);

// DELETE /api/admin/return-shipping-rules/:id - Delete return shipping rule
router.delete('/:id', deleteReturnShippingRule);

export default router;

