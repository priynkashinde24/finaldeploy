import { Router } from 'express';
import {
  createRMARequest,
  getRMA,
  listRMAs,
  approveRMARequest,
  rejectRMARequest,
  receiveRMAItems,
  updateRMAStatus,
} from '../controllers/rma.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// POST /api/rma/orders/:orderId - Create RMA request (authenticated users)
router.post('/orders/:orderId', authenticate, createRMARequest);

// GET /api/rma - List RMAs (with filters)
router.get('/', authenticate, listRMAs);

// GET /api/rma/:id - Get RMA details
router.get('/:id', authenticate, getRMA);

// PATCH /api/rma/:id/approve - Approve RMA (admin/supplier only)
router.patch('/:id/approve', authenticate, authorize(['admin', 'supplier']), approveRMARequest);

// PATCH /api/rma/:id/reject - Reject RMA (admin/supplier only)
router.patch('/:id/reject', authenticate, authorize(['admin', 'supplier']), rejectRMARequest);

// PATCH /api/rma/:id/receive - Receive RMA items (admin/supplier only)
router.patch('/:id/receive', authenticate, authorize(['admin', 'supplier']), receiveRMAItems);

// PATCH /api/rma/:id/status - Update RMA status (admin/supplier only)
router.patch('/:id/status', authenticate, authorize(['admin', 'supplier']), updateRMAStatus);

export default router;

