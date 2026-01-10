import { Router } from 'express';
import {
  uploadPriceUpdateFile,
  getPriceUpdates,
  getPriceUpdateDetails,
  submitPriceUpdateForApproval,
  upload,
} from '../controllers/supplierPriceUpdate.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require supplier authentication
router.use(authenticate);
router.use(authorize(['supplier']));

// POST /supplier/price-updates/upload - Upload price update file
router.post('/upload', upload.single('file'), uploadPriceUpdateFile);

// GET /supplier/price-updates - List price updates
router.get('/', getPriceUpdates);

// GET /supplier/price-updates/:jobId - Get price update details
router.get('/:jobId', getPriceUpdateDetails);

// POST /supplier/price-updates/:jobId/submit - Submit for approval
router.post('/:jobId/submit', submitPriceUpdateForApproval);

export default router;

