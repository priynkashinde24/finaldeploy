import { Router } from 'express';
import {
  createStore,
  listStores,
  getStore,
  updateStore,
  disableStore,
  suspendStore,
  activateStore,
  getStoreUsage,
  createPriceOverride,
  listPriceOverrides,
  updatePriceOverride,
  disablePriceOverride,
} from '../controllers/adminStore.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// Store CRUD routes
router.post('/stores', createStore);
router.get('/stores', listStores);
router.get('/stores/:id', getStore);
router.patch('/stores/:id', updateStore);
router.patch('/stores/:id/disable', disableStore); // Legacy: use suspend instead
router.patch('/stores/:id/suspend', suspendStore);
router.patch('/stores/:id/activate', activateStore);
router.get('/stores/:id/usage', getStoreUsage);

// Price override routes
router.post('/stores/:id/price-overrides', createPriceOverride);
router.get('/stores/:id/price-overrides', listPriceOverrides);
router.patch('/stores/:id/price-overrides/:overrideId', updatePriceOverride);
router.patch('/stores/:id/price-overrides/:overrideId/disable', disablePriceOverride);

export default router;

