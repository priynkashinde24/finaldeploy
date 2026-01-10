import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import { exportTallyVouchers } from '../controllers/tallyExport.controller';

const router = Router();

/**
 * Tally Accounting Export Routes
 * All routes require authentication + store context
 */

// GET /accounting/tally/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/accounting/tally/export', authenticate, resolveStore, exportTallyVouchers);

export default router;


