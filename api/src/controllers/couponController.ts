import { Request, Response, NextFunction } from 'express';
import { Coupon } from '../models/Coupon';
import { CouponRedemption } from '../models/CouponRedemption';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { validateCoupon, applyCoupon, Cart } from '../services/couponService';
import { z } from 'zod';

// Validation schemas
const createCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  type: z.enum(['percent', 'fixed', 'bogo', 'tiered']),
  value: z.number().min(0, 'Value must be greater than or equal to 0'),
  conditions: z
    .object({
      minOrder: z.number().min(0).optional(),
      productSkus: z.array(z.string()).optional(),
      usageLimitPerUser: z.number().min(1).optional(),
      maxRedemptions: z.number().min(1).optional(),
    })
    .optional(),
  storeId: z.string().min(1, 'Store ID is required'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional().default(true),
});

const validateCouponSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  code: z.string().min(1, 'Coupon code is required'),
  cart: z.object({
    items: z.array(
      z.object({
        productId: z.string(),
        sku: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        totalPrice: z.number().min(0),
      })
    ),
    subtotal: z.number().min(0).optional(),
  }),
  userId: z.string().optional(),
});

const redeemCouponSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  storeId: z.string().min(1, 'Store ID is required'),
  code: z.string().min(1, 'Coupon code is required'),
  cart: z.object({
    items: z.array(
      z.object({
        productId: z.string(),
        sku: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        totalPrice: z.number().min(0),
      })
    ),
    subtotal: z.number().min(0).optional(),
  }),
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * Create coupon
 * POST /api/coupons
 */
export const createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = createCouponSchema.parse(req.body);

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({
      code: validatedData.code.toUpperCase(),
      storeId: validatedData.storeId,
    });

    if (existingCoupon) {
      sendError(res, 'Coupon code already exists for this store', 400);
      return;
    }

    // Generate coupon ID
    const couponId = `coupon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const coupon = new Coupon({
      couponId,
      code: validatedData.code.toUpperCase(),
      type: validatedData.type,
      value: validatedData.value,
      conditions: validatedData.conditions || {},
      storeId: validatedData.storeId,
      startsAt: validatedData.startsAt ? new Date(validatedData.startsAt) : undefined,
      endsAt: validatedData.endsAt ? new Date(validatedData.endsAt) : undefined,
      active: validatedData.active,
    });

    await coupon.save();

    sendSuccess(res, coupon, 'Coupon created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Validate coupon
 * POST /api/coupons/validate
 */
export const validateCouponEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = validateCouponSchema.parse(req.body);
    const { storeId, code, cart, userId } = validatedData;

    const result = await validateCoupon(storeId, code, cart as Cart, userId);

    if (!result.valid) {
      sendError(res, result.reason || 'Invalid coupon', 400);
      return;
    }

    sendSuccess(res, {
      valid: true,
      discountAmount: result.discountAmount,
      coupon: {
        couponId: result.coupon?.couponId,
        code: result.coupon?.code,
        type: result.coupon?.type,
        value: result.coupon?.value,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Redeem coupon
 * POST /api/coupons/redeem
 */
export const redeemCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = redeemCouponSchema.parse(req.body);
    const { userId, storeId, code, cart, orderId } = validatedData;

    // Validate coupon
    const validation = await validateCoupon(storeId, code, cart as Cart, userId);

    if (!validation.valid) {
      sendError(res, validation.reason || 'Invalid coupon', 400);
      return;
    }

    // Calculate discount
    const discountAmount = applyCoupon(cart as Cart, validation.coupon!);

    // Create redemption record
    const redemptionId = `redemption_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const redemption = new CouponRedemption({
      redemptionId,
      couponId: validation.coupon!.couponId,
      code: validation.coupon!.code,
      userId,
      orderId,
      discountAmount,
    });

    await redemption.save();

    sendSuccess(
      res,
      {
        redemptionId,
        discountAmount,
        coupon: {
          couponId: validation.coupon!.couponId,
          code: validation.coupon!.code,
          type: validation.coupon!.type,
        },
      },
      'Coupon redeemed successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all coupons
 * GET /api/coupons
 */
export const getAllCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storeId, active } = req.query;

    const filter: any = {};
    if (storeId) filter.storeId = storeId;
    if (active !== undefined) filter.active = active === 'true';

    const coupons = await Coupon.find(filter).sort({ createdAt: -1 }).limit(1000);

    // Get redemption counts for each coupon
    const couponsWithStats = await Promise.all(
      coupons.map(async (coupon) => {
        const redemptionCount = await CouponRedemption.countDocuments({ couponId: coupon.couponId });
        return {
          ...coupon.toObject(),
          redemptionCount,
        };
      })
    );

    sendSuccess(res, couponsWithStats, 'Coupons retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get coupon by ID
 * GET /api/coupons/:couponId
 */
export const getCouponById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findOne({ couponId });

    if (!coupon) {
      sendError(res, 'Coupon not found', 404);
      return;
    }

    const redemptionCount = await CouponRedemption.countDocuments({ couponId });
    const redemptions = await CouponRedemption.find({ couponId })
      .sort({ createdAt: -1 })
      .limit(50);

    sendSuccess(res, {
      ...coupon.toObject(),
      redemptionCount,
      recentRedemptions: redemptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update coupon
 * PUT /api/coupons/:couponId
 */
export const updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;
    const updateData = req.body;

    const coupon = await Coupon.findOne({ couponId });

    if (!coupon) {
      sendError(res, 'Coupon not found', 404);
      return;
    }

    // Update fields
    if (updateData.active !== undefined) coupon.active = updateData.active;
    if (updateData.endsAt) coupon.endsAt = new Date(updateData.endsAt);
    if (updateData.value !== undefined) coupon.value = updateData.value;
    if (updateData.conditions) coupon.conditions = { ...coupon.conditions, ...updateData.conditions };

    await coupon.save();

    sendSuccess(res, coupon, 'Coupon updated successfully');
  } catch (error) {
    next(error);
  }
};

