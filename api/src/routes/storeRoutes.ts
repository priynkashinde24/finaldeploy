import { Router } from 'express';
import {
  createStore,
  getStore,
  getStoresByOwner,
  updateStoreTheme,
  setStoreDomain,
  verifyStoreDomain,
} from '../controllers/storeController';
import { getThemes } from '../controllers/store.controller';
import { createStoreOneClick } from '../controllers/storeCreation.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Routes that DON'T require store resolution (must come first, before :id routes)
// GET /api/stores/themes - Get all available themes (public)
router.get('/themes', getThemes);

// POST /api/stores/create - One-click store creation (reseller only)
router.post('/create', authenticate, authorize(['reseller', 'admin']), createStoreOneClick);

// POST /api/stores - Create a new store (legacy - keep for backward compatibility)
router.post('/', authenticate, createStore);

// GET /api/stores?ownerId=xxx - Get stores by owner ID
router.get('/', getStoresByOwner);

// Routes that REQUIRE store resolution (these will be registered separately with resolveStore middleware)
// PUT /api/stores/:id/theme - Update store theme
router.put('/:id/theme', updateStoreTheme);

// POST /api/stores/:id/domain - Set custom domain
router.post('/:id/domain', setStoreDomain);

// GET /api/stores/:id/domain/verify - Verify domain
router.get('/:id/domain/verify', verifyStoreDomain);

// GET /api/stores/:id - Get a store by ID (must be last to avoid route conflicts)
router.get('/:id', getStore);

export default router;

