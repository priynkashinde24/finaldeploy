import { Router } from 'express';
import { listPendingApprovals, approveEntity, rejectEntity } from '../controllers/adminApproval.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /api/admin/approvals - List all pending approvals
router.get('/', listPendingApprovals);

// PATCH /api/admin/approvals/:type/:id/approve - Approve entity
router.patch('/:type/:id/approve', approveEntity);

// PATCH /api/admin/approvals/:type/:id/reject - Reject entity
router.patch('/:type/:id/reject', rejectEntity);

export default router;

