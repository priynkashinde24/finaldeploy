import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getCategorySales,
  getOrderStatusDistribution,
  getOrders,
  getOverview,
  getRevenue,
} from '../controllers/analyticsDashboard.controller';

/**
 * Analytics Dashboard Routes (Admin)
 *
 * Requested endpoints:
 * - GET /analytics/overview
 * - GET /analytics/revenue?range=daily|weekly|monthly
 * - GET /analytics/top-products  (already exists in salesAnalytics.routes.ts)
 * - GET /analytics/orders
 *
 * Additional endpoints used by the dashboard:
 * - GET /analytics/categories
 * - GET /analytics/order-status
 */
const router = Router();

router.get('/analytics/overview', authenticate, resolveStore, getOverview);
router.get('/analytics/revenue', authenticate, resolveStore, getRevenue);
router.get('/analytics/categories', authenticate, resolveStore, getCategorySales);
router.get('/analytics/order-status', authenticate, resolveStore, getOrderStatusDistribution);
router.get('/analytics/orders', authenticate, resolveStore, getOrders);

export default router;


