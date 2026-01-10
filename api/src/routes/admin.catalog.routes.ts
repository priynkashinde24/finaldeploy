import { Router } from 'express';
import {
  getPendingUploads,
  getUploadDetails,
  approveCatalogUpload,
  rejectCatalogUpload,
} from '../controllers/adminCatalogApproval.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /admin/catalog/uploads - List pending uploads
router.get('/uploads', getPendingUploads);

// GET /admin/catalog/uploads/:jobId - Get upload details
router.get('/uploads/:jobId', getUploadDetails);

// POST /admin/catalog/uploads/:jobId/approve - Approve upload
router.post('/uploads/:jobId/approve', approveCatalogUpload);

// POST /admin/catalog/uploads/:jobId/reject - Reject upload
router.post('/uploads/:jobId/reject', rejectCatalogUpload);

export default router;

