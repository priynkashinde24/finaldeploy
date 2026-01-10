import { Router } from 'express';
import {
  getProfitLossReport,
  getTaxSummaryReport,
  getRevenueBreakdown,
  getConsolidatedReport,
} from '../controllers/financialReports.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require store context and authentication
router.use(resolveStore);
router.use(authenticate);

/**
 * Financial Reports Routes
 * 
 * All routes are protected and require:
 * - Authentication
 * - Store context
 * - Role-based access (suppliers/resellers see own, admins see all)
 */

// GET /api/reports/profit-loss
// Generate P&L report for an entity
router.get('/profit-loss', getProfitLossReport);

// GET /api/reports/tax-summary
// Generate tax summary report (GST/VAT)
router.get('/tax-summary', getTaxSummaryReport);

// GET /api/reports/revenue-breakdown
// Generate revenue breakdown report
router.get('/revenue-breakdown', getRevenueBreakdown);

// GET /api/reports/consolidated
// Generate consolidated financial report (admin only)
router.get('/consolidated', getConsolidatedReport);

export default router;

