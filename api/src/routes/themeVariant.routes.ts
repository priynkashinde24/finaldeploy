import { Router } from 'express';
import { resolveStore, resolveStoreOptional } from '../middleware/resolveStore';
import { authenticate } from '../middleware/auth.middleware';
import { verifyStoreAccess } from '../middleware/verifyStoreAccess';
import {
  getActiveThemeHandler,
  listThemeVariantsHandler,
  applyThemeHandler,
  themeHistoryHandler,
  rollbackThemeHandler,
} from '../controllers/themeVariant.controller';

const router = Router();

// Public (store-scoped) - active theme for storefront consumption
router.get('/active', resolveStoreOptional, getActiveThemeHandler);

// Protected store owner/authorized
router.get('/variants', resolveStore, authenticate, verifyStoreAccess, listThemeVariantsHandler);
router.post('/apply', resolveStore, authenticate, verifyStoreAccess, applyThemeHandler);
router.get('/history', resolveStore, authenticate, verifyStoreAccess, themeHistoryHandler);
router.post('/rollback', resolveStore, authenticate, verifyStoreAccess, rollbackThemeHandler);

export default router;


