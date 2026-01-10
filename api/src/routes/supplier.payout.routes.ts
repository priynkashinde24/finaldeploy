import { Router } from 'express';
import { getSupplierPayouts } from '../controllers/supplierPayout.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require supplier authentication
router.use(authenticate);
router.use(authorize(['supplier']));

// GET /api/supplier/payouts - Get supplier's payouts
router.get('/', getSupplierPayouts);

export default router;

