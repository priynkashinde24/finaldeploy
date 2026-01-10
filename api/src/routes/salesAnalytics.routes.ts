import { Router } from 'express';
import {
  getSummary,
  getTimeseries,
  getTopProducts,
  getReturns,
  exportAnalytics,
} from '../controllers/salesAnalytics.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

/**
 * Sales Analytics Routes
 * 
 * All routes require authentication and store resolution
 */

// Summary KPIs
router.get('/analytics/summary', authenticate, resolveStore, getSummary);

// Time series data
router.get('/analytics/timeseries', authenticate, resolveStore, getTimeseries);

// Top products
router.get('/analytics/top-products', authenticate, resolveStore, getTopProducts);

// Returns analytics
router.get('/analytics/returns', authenticate, resolveStore, getReturns);

// Export analytics
router.get('/analytics/export', authenticate, resolveStore, exportAnalytics);

export default router;

