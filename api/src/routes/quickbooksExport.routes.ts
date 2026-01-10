import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import { exportQuickBooksTransactions } from '../controllers/quickbooksExport.controller';

const router = Router();

/**
 * QuickBooks Accounting Export Routes
 * All routes require authentication + store context
 */

// GET /accounting/quickbooks/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/accounting/quickbooks/export', authenticate, resolveStore, exportQuickBooksTransactions);

export default router;

