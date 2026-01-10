import { Router } from 'express';
import { submitKYC, getSupplierKYC } from '../controllers/supplierKyc.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { kycUpload } from '../utils/upload';

const router = Router();

// All routes require supplier authentication
router.use(authenticate);
router.use(authorize(['supplier']));

// POST /api/supplier/kyc - Submit KYC documents
router.post(
  '/',
  kycUpload.fields([
    { name: 'panCard', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'gstCertificate', maxCount: 1 },
  ]),
  submitKYC
);

// GET /api/supplier/kyc - Get supplier's own KYC status
router.get('/', getSupplierKYC);

export default router;

