import { Router } from 'express';
import {
  uploadCatalogFile,
  getCatalogUploads,
  getCatalogUploadDetails,
  submitForApproval,
  upload,
} from '../controllers/supplierCatalogUpload.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require supplier authentication
router.use(authenticate);
router.use(authorize(['supplier']));

// POST /supplier/catalog/upload - Upload catalog file
router.post('/upload', upload.single('file'), uploadCatalogFile);

// GET /supplier/catalog/uploads - List uploads
router.get('/uploads', getCatalogUploads);

// GET /supplier/catalog/uploads/:jobId - Get upload details
router.get('/uploads/:jobId', getCatalogUploadDetails);

// POST /supplier/catalog/uploads/:jobId/submit - Submit for approval
router.post('/uploads/:jobId/submit', submitForApproval);

export default router;

