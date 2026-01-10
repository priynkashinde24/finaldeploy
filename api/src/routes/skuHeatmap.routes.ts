import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getSKUHeatmap,
  getSKUTimelineHeatmap,
  getSKUDetail,
  getTopSKUs,
  getBottomSKUs,
  exportSKUHeatmap,
} from '../controllers/skuHeatmap.controller';

const router = Router();

/**
 * SKU Heatmap Analytics Routes
 * 
 * All routes require authentication and store resolution
 */

// GET /analytics/sku/heatmap - Get SKU heatmap data
router.get('/analytics/sku/heatmap', authenticate, resolveStore, getSKUHeatmap);

// GET /analytics/sku-heatmap - SKU vs time heatmap (day/hour)
router.get('/analytics/sku-heatmap', authenticate, resolveStore, getSKUTimelineHeatmap);

// GET /analytics/sku/:skuId/detail - Get SKU detail data
router.get('/analytics/sku/:skuId/detail', authenticate, resolveStore, getSKUDetail);

// GET /analytics/sku/top - Get top performing SKUs
router.get('/analytics/sku/top', authenticate, resolveStore, getTopSKUs);

// GET /analytics/sku/bottom - Get bottom performing SKUs
router.get('/analytics/sku/bottom', authenticate, resolveStore, getBottomSKUs);

// Aliases requested by dashboard specs
router.get('/analytics/top-skus', authenticate, resolveStore, getTopSKUs);
router.get('/analytics/bottom-skus', authenticate, resolveStore, getBottomSKUs);

// GET /analytics/sku/export - Export SKU heatmap data as CSV
router.get('/analytics/sku/export', authenticate, resolveStore, exportSKUHeatmap);

export default router;

