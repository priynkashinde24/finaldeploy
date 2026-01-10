import { Router } from 'express';
import {
  createCoupon,
  getCoupons,
  updateCoupon,
  disableCoupon,
} from '../controllers/adminCoupon.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/coupons - Create coupon
router.post('/', createCoupon);

// GET /admin/coupons - List all coupons
router.get('/', getCoupons);

// PATCH /admin/coupons/:id - Update coupon
router.patch('/:id', updateCoupon);

// PATCH /admin/coupons/:id/disable - Disable coupon
router.patch('/:id/disable', disableCoupon);

export default router;

