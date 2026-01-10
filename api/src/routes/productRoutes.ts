import { Router } from 'express';
import { getProducts } from '../controllers/productController';

const router = Router();

// GET /api/products - Get products (with optional filters)
router.get('/', getProducts);

export default router;

