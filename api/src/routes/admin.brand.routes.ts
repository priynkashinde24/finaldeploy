import { Router } from 'express';
import {
  createBrand,
  getBrands,
  updateBrand,
  disableBrand,
} from '../controllers/adminBrand.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/brands - Create brand
router.post('/', createBrand);

// GET /admin/brands - List all brands
router.get('/', getBrands);

// PATCH /admin/brands/:id - Update brand
router.patch('/:id', updateBrand);

// PATCH /admin/brands/:id/disable - Disable brand
router.patch('/:id/disable', disableBrand);

export default router;

