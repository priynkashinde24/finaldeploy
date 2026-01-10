import { Router } from 'express';
import {
  createPricingRule,
  getPricingRules,
  updatePricingRule,
  disablePricingRule,
} from '../controllers/adminPricing.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/pricing-rules - Create pricing rule
router.post('/', createPricingRule);

// GET /admin/pricing-rules - List all pricing rules
router.get('/', getPricingRules);

// PATCH /admin/pricing-rules/:id - Update pricing rule
router.patch('/:id', updatePricingRule);

// PATCH /admin/pricing-rules/:id/disable - Disable pricing rule
router.patch('/:id/disable', disablePricingRule);

export default router;

