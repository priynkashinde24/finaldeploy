import { Router } from 'express';
import { resolveStoreOptional } from '../middleware/resolveStore';
import { getActiveBrandingHandler } from '../controllers/brandingKit.controller';

const router = Router();

// Public endpoint to fetch active branding for current store (or null if no store)
router.get('/active', resolveStoreOptional, getActiveBrandingHandler);

export default router;


