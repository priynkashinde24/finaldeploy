import { Router } from 'express';
import {
  createCoupon,
  validateCouponEndpoint,
  redeemCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
} from '../controllers/couponController';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// POST /api/coupons - Create coupon (admin only)
router.post('/', authenticate, authorize(['admin']), createCoupon);

// POST /api/coupons/validate - Validate coupon (public)
router.post('/validate', validateCouponEndpoint);

// POST /api/coupons/redeem - Redeem coupon (authenticated users)
router.post('/redeem', authenticate, redeemCoupon);

// GET /api/coupons - Get all coupons (admin only)
router.get('/', authenticate, authorize(['admin']), getAllCoupons);

// GET /api/coupons/:couponId - Get coupon by ID (admin only)
router.get('/:couponId', authenticate, authorize(['admin']), getCouponById);

// PUT /api/coupons/:couponId - Update coupon (admin only)
router.put('/:couponId', authenticate, authorize(['admin']), updateCoupon);

export default router;

