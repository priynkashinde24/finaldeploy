import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  listSupplierTiers,
  getSupplierTierInfo,
  assignSupplierTier,
  getMyTier,
  requestTierUpgrade,
  getTierDefinitions,
} from '../controllers/supplierKycTier.controller';

const router = Router();

/**
 * Supplier KYC Tier Routes
 */

// Admin routes
router.get('/admin/kyc-tiers', authenticate, authorize(['admin']), listSupplierTiers);
router.get('/admin/kyc-tiers/definitions', authenticate, authorize(['admin']), getTierDefinitions);
router.get('/admin/kyc-tiers/:supplierId', authenticate, authorize(['admin']), getSupplierTierInfo);
router.post('/admin/kyc-tiers/assign', authenticate, authorize(['admin']), assignSupplierTier);

// Supplier routes
router.get('/supplier/kyc-tier', authenticate, authorize(['supplier']), getMyTier);
router.post('/supplier/kyc-tier/request-upgrade', authenticate, authorize(['supplier']), requestTierUpgrade);

export default router;

