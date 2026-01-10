import { Router } from 'express';
import { listStores, getProducts, getProductBySlug } from '../controllers/storefront.controller';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// Public routes - no authentication required
// GET /api/storefront/stores - List all active stores for browsing (no store resolution needed)
router.get('/stores', listStores);

// GET /api/storefront/products - List all sellable products (requires store resolution)
router.get('/products', resolveStore, getProducts);

// GET /api/storefront/products/:slug - Get product details (requires store resolution)
router.get('/products/:slug', resolveStore, getProductBySlug);

export default router;

