import { Router } from 'express';
import {
  getStore,
  updateStoreTheme,
  setStoreDomain,
  verifyStoreDomain,
} from '../controllers/storeController';

const router = Router();

// PUT /api/stores/:id/theme - Update store theme
router.put('/:id/theme', updateStoreTheme);

// POST /api/stores/:id/domain - Set custom domain
router.post('/:id/domain', setStoreDomain);

// GET /api/stores/:id/domain/verify - Verify domain
router.get('/:id/domain/verify', verifyStoreDomain);

// GET /api/stores/:id - Get a store by ID (must be last to avoid route conflicts)
router.get('/:id', getStore);

export default router;

