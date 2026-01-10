import { Router } from 'express';
import { getPayouts, processPayout, failPayout } from '../controllers/adminPayout.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

/**
 * Admin Payout Routes
 * 
 * All routes require:
 * - Authentication (authenticate middleware)
 * - Admin role (authorize middleware)
 */

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /admin/payouts - Get all payouts with filters
router.get('/', getPayouts);

// PATCH /admin/payouts/:id/process - Process a payout
router.patch('/:id/process', processPayout);

// PATCH /admin/payouts/:id/fail - Mark payout as failed
router.patch('/:id/fail', failPayout);

export default router;

