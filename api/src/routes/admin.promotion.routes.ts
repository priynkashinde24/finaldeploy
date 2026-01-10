import { Router } from 'express';
import {
  createPromotion,
  getPromotions,
  updatePromotion,
  disablePromotion,
} from '../controllers/adminPromotion.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/promotions - Create promotion
router.post('/', createPromotion);

// GET /admin/promotions - List all promotions
router.get('/', getPromotions);

// PATCH /admin/promotions/:id - Update promotion
router.patch('/:id', updatePromotion);

// PATCH /admin/promotions/:id/disable - Disable promotion
router.patch('/:id/disable', disablePromotion);

export default router;

