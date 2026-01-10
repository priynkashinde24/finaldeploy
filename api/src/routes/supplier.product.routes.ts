import { Router } from 'express';
import {
  getSupplierProducts,
  getGlobalProducts,
  createSupplierProduct,
  updateSupplierProduct,
} from '../controllers/supplierProduct.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require supplier authentication
router.use(authenticate);
router.use(authorize(['supplier']));

// Supplier product routes
router.get('/', getSupplierProducts);
router.get('/global', getGlobalProducts);
router.post('/', createSupplierProduct);
router.patch('/:id', updateSupplierProduct);

export default router;

