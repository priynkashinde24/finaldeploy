import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getGeoHeatmap,
  getInventoryAging,
  getPriceSensitivity,
  getSKURecommendations,
} from '../controllers/advancedAnalytics.controller';

const router = Router();

/**
 * Advanced Analytics Routes
 * 
 * All routes require authentication and store resolution
 */

// GET /analytics/geo/heatmap - Get geographic heatmap data
router.get('/analytics/geo/heatmap', authenticate, resolveStore, getGeoHeatmap);

// GET /analytics/inventory/aging - Get inventory aging heatmap
router.get('/analytics/inventory/aging', authenticate, resolveStore, getInventoryAging);

// GET /analytics/price/sensitivity - Get price sensitivity analysis
router.get('/analytics/price/sensitivity', authenticate, resolveStore, getPriceSensitivity);

// GET /analytics/sku/recommendations - Get AI SKU recommendations
router.get('/analytics/sku/recommendations', authenticate, resolveStore, getSKURecommendations);

export default router;

