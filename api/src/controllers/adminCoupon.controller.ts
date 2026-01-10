import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Coupon } from '../models/Coupon';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Coupon Controller
 * 
 * PURPOSE:
 * - Admin-only coupon management
 * - Create, read, update, disable coupons
 * - Track coupon usage and analytics
 */

// Validation schemas
const createCouponSchema = z.object({
  code: z.string().min(1).regex(/^[A-Z0-9]+$/, 'Code must contain only uppercase letters and numbers'),
  description: z.string().max(500).optional(),
  discountType: z.enum(['percentage', 'amount']),
  discountValue: z.number().min(0),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  minOrderValue: z.number().min(0).nullable().optional(),
  applicableScope: z.enum(['global', 'category', 'product', 'variant']),
  scopeId: z.string().nullable().optional(),
  usageLimit: z.number().min(1).nullable().optional(),
  usagePerUser: z.number().min(1).nullable().optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateCouponSchema = z.object({
  description: z.string().max(500).optional(),
  discountType: z.enum(['percentage', 'amount']).optional(),
  discountValue: z.number().min(0).optional(),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  minOrderValue: z.number().min(0).nullable().optional(),
  usageLimit: z.number().min(1).nullable().optional(),
  usagePerUser: z.number().min(1).nullable().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * POST /admin/coupons
 * Create a new coupon
 */
export const createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create coupons', 403);
      return;
    }

    // Validate request body
    const validatedData = createCouponSchema.parse(req.body);

    // Validate scopeId based on scope
    if (validatedData.applicableScope === 'global' && validatedData.scopeId !== null && validatedData.scopeId !== undefined) {
      sendError(res, 'Global scope must have scopeId as null', 400);
      return;
    }

    if (validatedData.applicableScope !== 'global' && !validatedData.scopeId) {
      sendError(res, `${validatedData.applicableScope} scope must have a scopeId`, 400);
      return;
    }

    // Validate dates
    const validFrom = new Date(validatedData.validFrom);
    const validTo = new Date(validatedData.validTo);
    if (validFrom >= validTo) {
      sendError(res, 'Valid from date must be before valid to date', 400);
      return;
    }

    // Validate discount value
    if (validatedData.discountType === 'percentage' && validatedData.discountValue > 100) {
      sendError(res, 'Percentage discount cannot exceed 100%', 400);
      return;
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: validatedData.code.toUpperCase() });
    if (existingCoupon) {
      sendError(res, 'Coupon code already exists', 400);
      return;
    }

    // Create coupon
    const coupon = new Coupon({
      code: validatedData.code.toUpperCase(),
      description: validatedData.description,
      discountType: validatedData.discountType,
      discountValue: validatedData.discountValue,
      maxDiscountAmount: validatedData.maxDiscountAmount ?? null,
      minOrderValue: validatedData.minOrderValue ?? null,
      applicableScope: validatedData.applicableScope,
      scopeId: validatedData.scopeId ? new mongoose.Types.ObjectId(validatedData.scopeId) : null,
      usageLimit: validatedData.usageLimit ?? null,
      usagePerUser: validatedData.usagePerUser ?? null,
      validFrom,
      validTo,
      status: validatedData.status || 'active',
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await coupon.save();

    // Populate for response
    await coupon.populate('scopeId');
    await coupon.populate('createdBy', 'name email');

    sendSuccess(res, { coupon }, 'Coupon created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/coupons
 * List all coupons
 */
export const getCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view coupons', 403);
      return;
    }

    const { status, scope } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (scope) {
      query.applicableScope = scope;
    }

    const coupons = await Coupon.find(query)
      .populate('scopeId')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { coupons }, 'Coupons fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/coupons/:id
 * Update a coupon
 */
export const updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update coupons', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updateCouponSchema.parse(req.body);

    // Find coupon
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      sendError(res, 'Coupon not found', 404);
      return;
    }

    // Validate dates if provided
    if (validatedData.validFrom || validatedData.validTo) {
      const validFrom = validatedData.validFrom ? new Date(validatedData.validFrom) : coupon.validFrom;
      const validTo = validatedData.validTo ? new Date(validatedData.validTo) : coupon.validTo;
      if (validFrom >= validTo) {
        sendError(res, 'Valid from date must be before valid to date', 400);
        return;
      }
    }

    // Validate discount value
    if (validatedData.discountType === 'percentage' && validatedData.discountValue && validatedData.discountValue > 100) {
      sendError(res, 'Percentage discount cannot exceed 100%', 400);
      return;
    }

    // Update coupon
    Object.assign(coupon, validatedData);
    if (validatedData.validFrom) {
      coupon.validFrom = new Date(validatedData.validFrom);
    }
    if (validatedData.validTo) {
      coupon.validTo = new Date(validatedData.validTo);
    }
    await coupon.save();

    // Populate for response
    await coupon.populate('scopeId');
    await coupon.populate('createdBy', 'name email');

    sendSuccess(res, { coupon }, 'Coupon updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/coupons/:id/disable
 * Disable a coupon
 */
export const disableCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable coupons', 403);
      return;
    }

    const { id } = req.params;

    // Find coupon
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      sendError(res, 'Coupon not found', 404);
      return;
    }

    // Disable coupon
    coupon.status = 'inactive';
    await coupon.save();

    // Populate for response
    await coupon.populate('scopeId');
    await coupon.populate('createdBy', 'name email');

    sendSuccess(res, { coupon }, 'Coupon disabled successfully');
  } catch (error) {
    next(error);
  }
};

