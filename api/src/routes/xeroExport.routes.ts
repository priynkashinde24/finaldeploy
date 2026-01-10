import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import { exportXeroTransactions } from '../controllers/xeroExport.controller';

const router = Router();

/**
 * Xero Accounting Export Routes
 * All routes require authentication + store context
 */

// GET /accounting/xero/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/accounting/xero/export', authenticate, resolveStore, exportXeroTransactions);

export default router;

