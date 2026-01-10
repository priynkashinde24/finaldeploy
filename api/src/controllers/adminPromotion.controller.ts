import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Promotion } from '../models/Promotion';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { Category } from '../models/Category';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Promotion Controller
 * 
 * PURPOSE:
 * - Admin-only promotion management
 * - Create, read, update, disable auto-applied promotions
 * - Track promotion effectiveness
 */

// Validation schemas
const createPromotionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  discountType: z.enum(['percentage', 'amount']),
  discountValue: z.number().min(0),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  applicableScope: z.enum(['category', 'product', 'variant']),
  scopeId: z.string().min(1),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updatePromotionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  discountType: z.enum(['percentage', 'amount']).optional(),
  discountValue: z.number().min(0).optional(),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * POST /admin/promotions
 * Create a new promotion
 */
export const createPromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create promotions', 403);
      return;
    }

    // Validate request body
    const validatedData = createPromotionSchema.parse(req.body);

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

    // Validate scopeId exists
    const scopeIdObj = new mongoose.Types.ObjectId(validatedData.scopeId);

    if (validatedData.applicableScope === 'product') {
      const product = await Product.findById(scopeIdObj);
      if (!product) {
        sendError(res, 'Product not found', 404);
        return;
      }
    } else if (validatedData.applicableScope === 'variant') {
      const variant = await ProductVariant.findById(scopeIdObj);
      if (!variant) {
        sendError(res, 'Product variant not found', 404);
        return;
      }
    } else if (validatedData.applicableScope === 'category') {
      const category = await Category.findById(scopeIdObj);
      if (!category) {
        sendError(res, 'Category not found', 404);
        return;
      }
    }

    // Create promotion
    const promotion = new Promotion({
      name: validatedData.name,
      description: validatedData.description,
      discountType: validatedData.discountType,
      discountValue: validatedData.discountValue,
      maxDiscountAmount: validatedData.maxDiscountAmount ?? null,
      applicableScope: validatedData.applicableScope,
      scopeId: scopeIdObj,
      validFrom,
      validTo,
      status: validatedData.status || 'active',
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await promotion.save();

    // Populate for response
    await promotion.populate('scopeId');
    await promotion.populate('createdBy', 'name email');

    sendSuccess(res, { promotion }, 'Promotion created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/promotions
 * List all promotions
 */
export const getPromotions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view promotions', 403);
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

    const promotions = await Promotion.find(query)
      .populate('scopeId')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { promotions }, 'Promotions fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/promotions/:id
 * Update a promotion
 */
export const updatePromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update promotions', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updatePromotionSchema.parse(req.body);

    // Find promotion
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      sendError(res, 'Promotion not found', 404);
      return;
    }

    // Validate dates if provided
    if (validatedData.validFrom || validatedData.validTo) {
      const validFrom = validatedData.validFrom ? new Date(validatedData.validFrom) : promotion.validFrom;
      const validTo = validatedData.validTo ? new Date(validatedData.validTo) : promotion.validTo;
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

    // Update promotion
    Object.assign(promotion, validatedData);
    if (validatedData.validFrom) {
      promotion.validFrom = new Date(validatedData.validFrom);
    }
    if (validatedData.validTo) {
      promotion.validTo = new Date(validatedData.validTo);
    }
    await promotion.save();

    // Populate for response
    await promotion.populate('scopeId');
    await promotion.populate('createdBy', 'name email');

    sendSuccess(res, { promotion }, 'Promotion updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/promotions/:id/disable
 * Disable a promotion
 */
export const disablePromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable promotions', 403);
      return;
    }

    const { id } = req.params;

    // Find promotion
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      sendError(res, 'Promotion not found', 404);
      return;
    }

    // Disable promotion
    promotion.status = 'inactive';
    await promotion.save();

    // Populate for response
    await promotion.populate('scopeId');
    await promotion.populate('createdBy', 'name email');

    sendSuccess(res, { promotion }, 'Promotion disabled successfully');
  } catch (error) {
    next(error);
  }
};

