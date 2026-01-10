import { Router } from 'express';
import { uploadCatalog, upload } from '../controllers/catalogController';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// POST /api/catalog/upload - Upload catalog file (supplier or admin)
router.post('/upload', authenticate, authorize(['supplier', 'admin']), upload.single('file'), uploadCatalog);

export default router;

