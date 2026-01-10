import { Router } from 'express';
import { getKYCFile } from '../controllers/kycFile.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/kyc/files/:filename - Get KYC document file
router.get('/:filename', getKYCFile);

export default router;

