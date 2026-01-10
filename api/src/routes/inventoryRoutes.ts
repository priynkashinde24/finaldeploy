import { Router } from 'express';
import {
  getSupplierVariantInventory,
  getSupplierVariantReservations,
  getInventoryHealth,
  getOversellAttempts,
} from '../controllers/inventoryController';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require authentication and store context
router.use(authenticate);
router.use(resolveStore);

// Supplier routes
router.get('/supplier/variants', authorize(['supplier']), getSupplierVariantInventory);
router.get('/supplier/variants/:variantId/reservations', authorize(['supplier']), getSupplierVariantReservations);

// Admin routes
router.get('/admin/health', authorize(['admin']), getInventoryHealth);
router.get('/admin/oversell-attempts', authorize(['admin']), getOversellAttempts);

export default router;

