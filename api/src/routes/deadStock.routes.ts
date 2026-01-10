import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getDeadStockAlerts,
  getDeadStockAlert,
  acknowledgeDeadStockAlert,
  resolveDeadStockAlert,
  getDeadStockRules,
  createOrUpdateDeadStockRule,
  getDeadStockAnalytics,
} from '../controllers/deadStock.controller';

const router = Router();

/**
 * Dead Stock Alert Routes
 * 
 * All routes require authentication and store resolution
 */

// GET /dead-stock-alerts - Get dead stock alerts
router.get('/dead-stock-alerts', authenticate, resolveStore, getDeadStockAlerts);

// GET /dead-stock-alerts/:id - Get single dead stock alert
router.get('/dead-stock-alerts/:id', authenticate, resolveStore, getDeadStockAlert);

// PATCH /dead-stock-alerts/:id/acknowledge - Acknowledge alert
router.patch('/dead-stock-alerts/:id/acknowledge', authenticate, resolveStore, acknowledgeDeadStockAlert);

// PATCH /dead-stock-alerts/:id/resolve - Resolve alert
router.patch('/dead-stock-alerts/:id/resolve', authenticate, resolveStore, resolveDeadStockAlert);

// GET /dead-stock-rules - Get dead stock rules
router.get('/dead-stock-rules', authenticate, resolveStore, getDeadStockRules);

// POST /dead-stock-rules - Create or update dead stock rule
router.post('/dead-stock-rules', authenticate, resolveStore, createOrUpdateDeadStockRule);

// GET /dead-stock-analytics - Get dead stock analytics
router.get('/dead-stock-analytics', authenticate, resolveStore, getDeadStockAnalytics);

export default router;

