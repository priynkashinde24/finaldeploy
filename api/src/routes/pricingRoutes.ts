import { Router } from 'express';
import {
  setGlobalMarkup,
  setSkuOverride,
  getCalculatedPrice,
  getStorePricingRules,
  deleteOverride,
} from '../controllers/pricingController';

const router = Router();

// POST /api/pricing/global - Set global markup for store
router.post('/global', setGlobalMarkup);

// POST /api/pricing/override - Set SKU override
router.post('/override', setSkuOverride);

// GET /api/pricing/:storeId/rules - Get all pricing rules for store
router.get('/:storeId/rules', getStorePricingRules);

// GET /api/pricing/:storeId/:sku?basePrice=X - Calculate final price
router.get('/:storeId/:sku', getCalculatedPrice);

// DELETE /api/pricing/:storeId/override/:overrideId - Delete override
router.delete('/:storeId/override/:overrideId', deleteOverride);

export default router;

