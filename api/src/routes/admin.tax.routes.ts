import { Router } from 'express';
import {
  createTaxRate,
  getTaxRates,
  updateTaxRate,
  createTaxProfile,
  getTaxProfiles,
} from '../controllers/adminTax.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// Tax Rates (new tax engine)
// POST /api/admin/tax-rates - Create tax rate
router.post('/tax-rates', createTaxRate);

// GET /api/admin/tax-rates - Get tax rates
router.get('/tax-rates', getTaxRates);

// PATCH /api/admin/tax-rates/:id - Update tax rate
router.patch('/tax-rates/:id', updateTaxRate);

// Tax Profiles (new tax engine)
// POST /api/admin/tax-profiles - Create or update tax profile
router.post('/tax-profiles', createTaxProfile);

// GET /api/admin/tax-profiles - Get tax profiles
router.get('/tax-profiles', getTaxProfiles);

export default router;

