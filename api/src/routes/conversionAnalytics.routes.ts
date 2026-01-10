import { Router } from 'express';
import {
  getConversionSummary,
  getConversionTimeseries,
  exportConversionAnalytics,
} from '../controllers/conversionAnalytics.controller';
import {
  getConversionBreakdown,
  getConversionFunnel,
  getConversionOverview,
  getConversionTrend,
  ingestConversionEvent,
} from '../controllers/conversionFunnelDashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore, resolveStoreOptional } from '../middleware/resolveStore';

const router = Router();

/**
 * Conversion Analytics Routes
 * 
 * All routes require authentication and store resolution
 */

// Conversion summary
router.get('/analytics/conversion/summary', authenticate, resolveStore, getConversionSummary);

// Funnel visualization
router.get('/analytics/conversion/funnel', authenticate, resolveStore, getConversionFunnel);

// Time series data
router.get('/analytics/conversion/timeseries', authenticate, resolveStore, getConversionTimeseries);

// Export conversion data
router.get('/analytics/conversion/export', authenticate, resolveStore, exportConversionAnalytics);

// Session-based conversion dashboard APIs (requested)
router.get('/analytics/conversion/overview', authenticate, resolveStore, getConversionOverview);
router.get('/analytics/conversion/trend', authenticate, resolveStore, getConversionTrend);
router.get('/analytics/conversion/breakdown', authenticate, resolveStore, getConversionBreakdown);

// Public funnel event ingestion (no auth, optional store resolution, CSRF-exempt)
router.post('/analytics/conversion/event', resolveStoreOptional, ingestConversionEvent);

export default router;

