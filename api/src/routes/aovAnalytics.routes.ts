import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getAOVSummary,
  getAOVTimeseries,
  getAOVBreakdown,
  exportAOVAnalytics,
} from '../controllers/aovAnalytics.controller';

const router = Router();

/**
 * AOV Analytics Routes
 * 
 * All routes require authentication and store resolution
 */

// GET /analytics/aov/summary - Get AOV summary KPIs
router.get('/analytics/aov/summary', authenticate, resolveStore, getAOVSummary);

// GET /analytics/aov/timeseries - Get AOV time series data
router.get('/analytics/aov/timeseries', authenticate, resolveStore, getAOVTimeseries);

// GET /analytics/aov/breakdown - Get AOV breakdown by payment method, category, or customer type
router.get('/analytics/aov/breakdown', authenticate, resolveStore, getAOVBreakdown);

// GET /analytics/aov/export - Export AOV data as CSV
router.get('/analytics/aov/export', authenticate, resolveStore, exportAOVAnalytics);

export default router;

