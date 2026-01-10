import { Router } from 'express';
import { getThemes } from '../controllers/store.controller';
import { createStoreOneClick } from '../controllers/storeCreation.controller';
import { createStore, getStoresByOwner } from '../controllers/storeController';
import { authenticate, authorize, authenticateOptional } from '../middleware/auth.middleware';

const router = Router();

// GET /api/stores/themes - Get all available themes (public)
router.get('/themes', getThemes);

// POST /api/stores/create - One-click store creation (reseller only)
router.post('/create', authenticate, authorize(['reseller', 'admin']), createStoreOneClick);

// POST /api/stores - Create a new store (legacy - keep for backward compatibility)
router.post('/', authenticate, createStore);

// GET /api/stores?ownerId=xxx - Get stores by owner ID
// Optional authentication - if authenticated, uses user's ID if ownerId not provided
router.get('/', authenticateOptional, getStoresByOwner);

export default router;

