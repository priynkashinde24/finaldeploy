import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PricingRule } from '../models/PricingRule';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { Category } from '../models/Category';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Pricing Controller
 * 
 * PURPOSE:
 * - Admin-only pricing rule management
 * - Create, read, update, disable pricing rules
 * - Control system-wide pricing constraints
 */

// Validation schemas
const createPricingRuleSchema = z.object({
  scope: z.enum(['product', 'variant', 'category', 'global']),
  scopeId: z.string().nullable().optional(),
  minMarginType: z.enum(['amount', 'percentage']),
  minMarginValue: z.number().min(0),
  maxDiscountPercentage: z.number().min(0).max(100).nullable().optional(),
  minSellingPrice: z.number().min(0).nullable().optional(),
  maxSellingPrice: z.number().min(0).nullable().optional(),
  enforceOn: z.array(z.enum(['reseller', 'storefront'])).min(1),
  status: z.enum(['active', 'inactive']).optional(),
});

const updatePricingRuleSchema = z.object({
  minMarginType: z.enum(['amount', 'percentage']).optional(),
  minMarginValue: z.number().min(0).optional(),
  maxDiscountPercentage: z.number().min(0).max(100).nullable().optional(),
  minSellingPrice: z.number().min(0).nullable().optional(),
  maxSellingPrice: z.number().min(0).nullable().optional(),
  enforceOn: z.array(z.enum(['reseller', 'storefront'])).min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * POST /admin/pricing-rules
 * Create a new pricing rule
 */
export const createPricingRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create pricing rules', 403);
      return;
    }

    // Validate request body
    const validatedData = createPricingRuleSchema.parse(req.body);

    // Validate scopeId based on scope
    if (validatedData.scope === 'global' && validatedData.scopeId !== null && validatedData.scopeId !== undefined) {
      sendError(res, 'Global scope must have scopeId as null', 400);
      return;
    }

    if (validatedData.scope !== 'global' && !validatedData.scopeId) {
      sendError(res, `${validatedData.scope} scope must have a scopeId`, 400);
      return;
    }

    // Validate scopeId exists
    if (validatedData.scopeId) {
      const scopeIdObj = new mongoose.Types.ObjectId(validatedData.scopeId);

      if (validatedData.scope === 'product') {
        const product = await Product.findById(scopeIdObj);
        if (!product) {
          sendError(res, 'Product not found', 404);
          return;
        }
      } else if (validatedData.scope === 'variant') {
        const variant = await ProductVariant.findById(scopeIdObj);
        if (!variant) {
          sendError(res, 'Product variant not found', 404);
          return;
        }
      } else if (validatedData.scope === 'category') {
        const category = await Category.findById(scopeIdObj);
        if (!category) {
          sendError(res, 'Category not found', 404);
          return;
        }
      }
    }

    // Check for existing active rule with same scope + scopeId
    if (validatedData.status !== 'inactive') {
      const existingRule = await PricingRule.findOne({
        scope: validatedData.scope,
        scopeId: validatedData.scopeId ? new mongoose.Types.ObjectId(validatedData.scopeId) : null,
        status: 'active',
      });

      if (existingRule) {
        // Check if this rule would affect existing reseller products
        const { ResellerProduct } = await import('../models/ResellerProduct');
        let affectedCount = 0;

        if (validatedData.scope === 'global') {
          affectedCount = await ResellerProduct.countDocuments({ status: 'active' });
        } else if (validatedData.scope === 'product' && validatedData.scopeId) {
          affectedCount = await ResellerProduct.countDocuments({
            productId: new mongoose.Types.ObjectId(validatedData.scopeId),
            status: 'active',
          });
        } else if (validatedData.scope === 'category' && validatedData.scopeId) {
          const { Product } = await import('../models/Product');
          const productsInCategory = await Product.find({
            categoryId: new mongoose.Types.ObjectId(validatedData.scopeId),
          }).distinct('_id');
          affectedCount = await ResellerProduct.countDocuments({
            productId: { $in: productsInCategory },
            status: 'active',
          });
        }

        if (affectedCount > 0) {
          sendError(
            res,
            `An active pricing rule already exists for this scope. This rule would affect ${affectedCount} existing reseller product(s). Disable the existing rule first or update it.`,
            400
          );
          return;
        } else {
          sendError(
            res,
            'An active pricing rule already exists for this scope. Disable it first or update the existing rule.',
            400
          );
          return;
        }
      }
    }

    // Validate min < max if both are set
    if (
      validatedData.minSellingPrice !== null &&
      validatedData.minSellingPrice !== undefined &&
      validatedData.maxSellingPrice !== null &&
      validatedData.maxSellingPrice !== undefined &&
      validatedData.minSellingPrice > validatedData.maxSellingPrice
    ) {
      sendError(res, 'Minimum selling price must be less than or equal to maximum selling price', 400);
      return;
    }

    // Create pricing rule
    const pricingRule = new PricingRule({
      scope: validatedData.scope,
      scopeId: validatedData.scopeId ? new mongoose.Types.ObjectId(validatedData.scopeId) : null,
      minMarginType: validatedData.minMarginType,
      minMarginValue: validatedData.minMarginValue,
      maxDiscountPercentage: validatedData.maxDiscountPercentage ?? null,
      minSellingPrice: validatedData.minSellingPrice ?? null,
      maxSellingPrice: validatedData.maxSellingPrice ?? null,
      enforceOn: validatedData.enforceOn,
      status: validatedData.status || 'active',
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await pricingRule.save();

    // Populate scopeId for response
    await pricingRule.populate('scopeId');
    await pricingRule.populate('createdBy', 'name email');

    sendSuccess(res, { rule: pricingRule }, 'Pricing rule created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/pricing-rules
 * List all pricing rules
 */
export const getPricingRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view pricing rules', 403);
      return;
    }

    const { scope, status } = req.query;

    const query: any = {};
    if (scope) {
      query.scope = scope;
    }
    if (status) {
      query.status = status;
    }

    const rules = await PricingRule.find(query)
      .populate('scopeId')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { rules }, 'Pricing rules fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/pricing-rules/:id
 * Update a pricing rule
 */
export const updatePricingRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update pricing rules', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updatePricingRuleSchema.parse(req.body);

    // Find pricing rule
    const pricingRule = await PricingRule.findById(id);
    if (!pricingRule) {
      sendError(res, 'Pricing rule not found', 404);
      return;
    }

    // Validate min < max if both are being updated
    const minPrice = validatedData.minSellingPrice ?? pricingRule.minSellingPrice;
    const maxPrice = validatedData.maxSellingPrice ?? pricingRule.maxSellingPrice;

    if (
      minPrice !== null &&
      minPrice !== undefined &&
      maxPrice !== null &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      sendError(res, 'Minimum selling price must be less than or equal to maximum selling price', 400);
      return;
    }

    // Check for active rule conflict if activating
    if (validatedData.status === 'active' && pricingRule.status === 'inactive') {
      const existingRule = await PricingRule.findOne({
        scope: pricingRule.scope,
        scopeId: pricingRule.scopeId,
        status: 'active',
        _id: { $ne: id },
      });

      if (existingRule) {
        sendError(res, 'An active pricing rule already exists for this scope. Disable it first.', 400);
        return;
      }
    }

    // Update pricing rule
    Object.assign(pricingRule, validatedData);
    await pricingRule.save();

    // Populate for response
    await pricingRule.populate('scopeId');
    await pricingRule.populate('createdBy', 'name email');

    sendSuccess(res, { rule: pricingRule }, 'Pricing rule updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/pricing-rules/:id/disable
 * Disable a pricing rule
 */
export const disablePricingRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable pricing rules', 403);
      return;
    }

    const { id } = req.params;

    // Find pricing rule
    const pricingRule = await PricingRule.findById(id);
    if (!pricingRule) {
      sendError(res, 'Pricing rule not found', 404);
      return;
    }

    // Disable rule
    pricingRule.status = 'inactive';
    await pricingRule.save();

    // Populate for response
    await pricingRule.populate('scopeId');
    await pricingRule.populate('createdBy', 'name email');

    sendSuccess(res, { rule: pricingRule }, 'Pricing rule disabled successfully');
  } catch (error) {
    next(error);
  }
};


