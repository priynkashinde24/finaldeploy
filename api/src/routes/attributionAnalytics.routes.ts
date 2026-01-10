import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getAttributionSummary,
  getChannelPerformance,
  compareAttributionModels,
  getAttributionROI,
  getAttributionPaths,
} from '../controllers/attributionAnalytics.controller';

const router = Router();

/**
 * Attribution Analytics Routes
 * 
 * All routes require authentication and store resolution
 */

// GET /analytics/attribution/summary - Get attribution summary
router.get('/analytics/attribution/summary', authenticate, resolveStore, getAttributionSummary);
// Alias: GET /analytics/attribution/overview
router.get('/analytics/attribution/overview', authenticate, resolveStore, getAttributionSummary);

// GET /analytics/attribution/channels - Get channel performance
router.get('/analytics/attribution/channels', authenticate, resolveStore, getChannelPerformance);
// Alias: GET /analytics/attribution/by-channel
router.get('/analytics/attribution/by-channel', authenticate, resolveStore, getChannelPerformance);

// GET /analytics/attribution/compare - Compare attribution models
router.get('/analytics/attribution/compare', authenticate, resolveStore, compareAttributionModels);
// Alias: GET /analytics/attribution/models-compare
router.get('/analytics/attribution/models-compare', authenticate, resolveStore, compareAttributionModels);

// GET /analytics/attribution/roi - Get ROI by channel
router.get('/analytics/attribution/roi', authenticate, resolveStore, getAttributionROI);

// GET /analytics/attribution/paths - Top conversion paths
router.get('/analytics/attribution/paths', authenticate, resolveStore, getAttributionPaths);

export default router;

