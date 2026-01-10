import { Router } from 'express';
import {
  listPricingInsights,
  getPricingInsight,
  generatePricingInsight,
} from '../controllers/adminPricingInsights.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /api/admin/pricing-insights - List all pricing insights
router.get('/pricing-insights', listPricingInsights);

// GET /api/admin/pricing-insights/:scope/:id - Get insight for specific product/variant
router.get('/pricing-insights/:scope/:id', getPricingInsight);

// POST /api/admin/pricing-insights/generate - Manually trigger insight generation
router.post('/pricing-insights/generate', generatePricingInsight);

export default router;

