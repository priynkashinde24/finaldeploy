import { Router } from 'express';
import {
  getPendingPriceUpdates,
  getPriceUpdateDetails,
  approvePriceUpdate,
  rejectPriceUpdate,
} from '../controllers/adminPriceUpdateApproval.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /admin/price-updates - List pending price updates
router.get('/', getPendingPriceUpdates);

// GET /admin/price-updates/:jobId - Get price update details
router.get('/:jobId', getPriceUpdateDetails);

// POST /admin/price-updates/:jobId/approve - Approve price update
router.post('/:jobId/approve', approvePriceUpdate);

// POST /admin/price-updates/:jobId/reject - Reject price update
router.post('/:jobId/reject', rejectPriceUpdate);

export default router;

