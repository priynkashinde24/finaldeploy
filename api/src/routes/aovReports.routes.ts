import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getAOVByCategory,
  getAOVByChannel,
  getAOVOverview,
  getAOVTrend,
  getHighValueOrders,
} from '../controllers/aovReports.controller';

const router = Router();

// GET /api/analytics/aov/overview
router.get('/analytics/aov/overview', authenticate, resolveStore, getAOVOverview);

// GET /api/analytics/aov/trend?interval=daily|weekly|monthly
router.get('/analytics/aov/trend', authenticate, resolveStore, getAOVTrend);

// GET /api/analytics/aov/by-category
router.get('/analytics/aov/by-category', authenticate, resolveStore, getAOVByCategory);

// GET /api/analytics/aov/by-channel
router.get('/analytics/aov/by-channel', authenticate, resolveStore, getAOVByChannel);

// GET /api/analytics/aov/high-value-orders
router.get('/analytics/aov/high-value-orders', authenticate, resolveStore, getHighValueOrders);

export default router;


