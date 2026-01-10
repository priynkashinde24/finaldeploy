import { Router } from 'express';
import { listKYCRequests, getKYCRequest, approveKYC, rejectKYC } from '../controllers/adminKyc.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /api/admin/kyc - List all KYC requests
router.get('/', listKYCRequests);

// GET /api/admin/kyc/:id - Get single KYC request
router.get('/:id', getKYCRequest);

// PATCH /api/admin/kyc/:id/approve - Approve KYC
router.patch('/:id/approve', approveKYC);

// PATCH /api/admin/kyc/:id/reject - Reject KYC
router.patch('/:id/reject', rejectKYC);

export default router;

