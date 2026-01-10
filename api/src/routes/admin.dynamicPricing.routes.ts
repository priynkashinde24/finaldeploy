import { Router } from 'express';
import {
  createDynamicPricingRule,
  getDynamicPricingRules,
  updateDynamicPricingRule,
  disableDynamicPricingRule,
} from '../controllers/adminDynamicPricing.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/dynamic-pricing - Create dynamic pricing rule
router.post('/', createDynamicPricingRule);

// GET /admin/dynamic-pricing - List all dynamic pricing rules
router.get('/', getDynamicPricingRules);

// PATCH /admin/dynamic-pricing/:id - Update dynamic pricing rule
router.patch('/:id', updateDynamicPricingRule);

// PATCH /admin/dynamic-pricing/:id/disable - Disable dynamic pricing rule
router.patch('/:id/disable', disableDynamicPricingRule);

export default router;

