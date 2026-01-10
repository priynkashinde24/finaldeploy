import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createVariant,
  listVariants,
  getVariant,
  updateVariant,
  deleteVariant,
} from '../controllers/adminVariant.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /api/admin/products/:id/variants - Create variant for product
router.post('/products/:id/variants', createVariant);

// GET /api/admin/products/:id/variants - List variants for product
router.get('/products/:id/variants', listVariants);

// GET /api/admin/variants/:id - Get variant
router.get('/variants/:id', getVariant);

// PATCH /api/admin/variants/:id - Update variant
router.patch('/variants/:id', updateVariant);

// DELETE /api/admin/variants/:id - Delete variant
router.delete('/variants/:id', deleteVariant);

export default router;

