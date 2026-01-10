import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { DynamicPricingRule } from '../models/DynamicPricingRule';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { Category } from '../models/Category';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Dynamic Pricing Controller
 * 
 * PURPOSE:
 * - Admin-only dynamic pricing rule management
 * - Create, read, update, disable dynamic pricing rules
 * - Control automatic price adjustments
 */

// Validation schemas
const createDynamicPricingRuleSchema = z.object({
  scope: z.enum(['global', 'category', 'product', 'variant']),
  scopeId: z.string().nullable().optional(),
  triggerType: z.enum(['low_stock', 'high_demand', 'time_window']),
  conditions: z.object({
    stockBelow: z.number().min(0).nullable().optional(),
    ordersAbove: z.number().min(0).nullable().optional(),
    startTime: z.string().datetime().nullable().optional(),
    endTime: z.string().datetime().nullable().optional(),
  }),
  adjustmentType: z.enum(['increase', 'decrease']),
  adjustmentMode: z.enum(['percentage', 'amount']),
  adjustmentValue: z.number().min(0),
  maxAdjustmentLimit: z.number().min(0).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().min(1).max(100),
});

const updateDynamicPricingRuleSchema = z.object({
  triggerType: z.enum(['low_stock', 'high_demand', 'time_window']).optional(),
  conditions: z
    .object({
      stockBelow: z.number().min(0).nullable().optional(),
      ordersAbove: z.number().min(0).nullable().optional(),
      startTime: z.string().datetime().nullable().optional(),
      endTime: z.string().datetime().nullable().optional(),
    })
    .optional(),
  adjustmentType: z.enum(['increase', 'decrease']).optional(),
  adjustmentMode: z.enum(['percentage', 'amount']).optional(),
  adjustmentValue: z.number().min(0).optional(),
  maxAdjustmentLimit: z.number().min(0).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().min(1).max(100).optional(),
});

/**
 * POST /admin/dynamic-pricing
 * Create a new dynamic pricing rule
 */
export const createDynamicPricingRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create dynamic pricing rules', 403);
      return;
    }

    // Validate request body
    const validatedData = createDynamicPricingRuleSchema.parse(req.body);

    // Validate scopeId based on scope
    if (validatedData.scope === 'global' && validatedData.scopeId !== null && validatedData.scopeId !== undefined) {
      sendError(res, 'Global scope must have scopeId as null', 400);
      return;
    }

    if (validatedData.scope !== 'global' && !validatedData.scopeId) {
      sendError(res, `${validatedData.scope} scope must have a scopeId`, 400);
      return;
    }

    // Validate conditions based on trigger type
    if (validatedData.triggerType === 'low_stock' && validatedData.conditions.stockBelow === null) {
      sendError(res, 'Low stock trigger requires stockBelow condition', 400);
      return;
    }
    if (validatedData.triggerType === 'high_demand' && validatedData.conditions.ordersAbove === null) {
      sendError(res, 'High demand trigger requires ordersAbove condition', 400);
      return;
    }
    if (validatedData.triggerType === 'time_window') {
      if (!validatedData.conditions.startTime || !validatedData.conditions.endTime) {
        sendError(res, 'Time window trigger requires startTime and endTime', 400);
        return;
      }
      const startTime = new Date(validatedData.conditions.startTime);
      const endTime = new Date(validatedData.conditions.endTime);
      if (startTime >= endTime) {
        sendError(res, 'Start time must be before end time', 400);
        return;
      }
    }

    // Validate adjustment value
    if (validatedData.adjustmentMode === 'percentage' && validatedData.adjustmentValue > 100) {
      sendError(res, 'Percentage adjustment cannot exceed 100%', 400);
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

    // Prepare conditions object
    const conditions: any = {
      stockBelow: validatedData.conditions.stockBelow ?? null,
      ordersAbove: validatedData.conditions.ordersAbove ?? null,
      startTime: validatedData.conditions.startTime ? new Date(validatedData.conditions.startTime) : null,
      endTime: validatedData.conditions.endTime ? new Date(validatedData.conditions.endTime) : null,
    };

    // Create dynamic pricing rule
    const rule = new DynamicPricingRule({
      scope: validatedData.scope,
      scopeId: validatedData.scopeId ? new mongoose.Types.ObjectId(validatedData.scopeId) : null,
      triggerType: validatedData.triggerType,
      conditions,
      adjustmentType: validatedData.adjustmentType,
      adjustmentMode: validatedData.adjustmentMode,
      adjustmentValue: validatedData.adjustmentValue,
      maxAdjustmentLimit: validatedData.maxAdjustmentLimit ?? null,
      status: validatedData.status || 'active',
      priority: validatedData.priority,
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await rule.save();

    // Populate for response
    await rule.populate('scopeId');
    await rule.populate('createdBy', 'name email');

    sendSuccess(res, { rule }, 'Dynamic pricing rule created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/dynamic-pricing
 * List all dynamic pricing rules
 */
export const getDynamicPricingRules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view dynamic pricing rules', 403);
      return;
    }

    const { status, scope, triggerType } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (scope) {
      query.scope = scope;
    }
    if (triggerType) {
      query.triggerType = triggerType;
    }

    const rules = await DynamicPricingRule.find(query)
      .populate('scopeId')
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    sendSuccess(res, { rules }, 'Dynamic pricing rules fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/dynamic-pricing/:id
 * Update a dynamic pricing rule
 */
export const updateDynamicPricingRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update dynamic pricing rules', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updateDynamicPricingRuleSchema.parse(req.body);

    // Find rule
    const rule = await DynamicPricingRule.findById(id);
    if (!rule) {
      sendError(res, 'Dynamic pricing rule not found', 404);
      return;
    }

    // Validate conditions if provided
    if (validatedData.conditions) {
      const triggerType = validatedData.triggerType || rule.triggerType;
      if (triggerType === 'low_stock' && validatedData.conditions.stockBelow === null) {
        sendError(res, 'Low stock trigger requires stockBelow condition', 400);
        return;
      }
      if (triggerType === 'high_demand' && validatedData.conditions.ordersAbove === null) {
        sendError(res, 'High demand trigger requires ordersAbove condition', 400);
        return;
      }
      if (triggerType === 'time_window') {
        const startTime = validatedData.conditions.startTime
          ? new Date(validatedData.conditions.startTime)
          : rule.conditions.startTime;
        const endTime = validatedData.conditions.endTime
          ? new Date(validatedData.conditions.endTime)
          : rule.conditions.endTime;
        if (startTime && endTime && startTime >= endTime) {
          sendError(res, 'Start time must be before end time', 400);
          return;
        }
      }
    }

    // Validate adjustment value
    if (validatedData.adjustmentMode === 'percentage' && validatedData.adjustmentValue && validatedData.adjustmentValue > 100) {
      sendError(res, 'Percentage adjustment cannot exceed 100%', 400);
      return;
    }

    // Update rule
    if (validatedData.triggerType) rule.triggerType = validatedData.triggerType;
    if (validatedData.conditions) {
      rule.conditions = {
        stockBelow: validatedData.conditions.stockBelow ?? rule.conditions.stockBelow,
        ordersAbove: validatedData.conditions.ordersAbove ?? rule.conditions.ordersAbove,
        startTime: validatedData.conditions.startTime
          ? new Date(validatedData.conditions.startTime)
          : rule.conditions.startTime,
        endTime: validatedData.conditions.endTime
          ? new Date(validatedData.conditions.endTime)
          : rule.conditions.endTime,
      };
    }
    if (validatedData.adjustmentType) rule.adjustmentType = validatedData.adjustmentType;
    if (validatedData.adjustmentMode) rule.adjustmentMode = validatedData.adjustmentMode;
    if (validatedData.adjustmentValue !== undefined) rule.adjustmentValue = validatedData.adjustmentValue;
    if (validatedData.maxAdjustmentLimit !== undefined)
      rule.maxAdjustmentLimit = validatedData.maxAdjustmentLimit;
    if (validatedData.status) rule.status = validatedData.status;
    if (validatedData.priority !== undefined) rule.priority = validatedData.priority;

    await rule.save();

    // Populate for response
    await rule.populate('scopeId');
    await rule.populate('createdBy', 'name email');

    sendSuccess(res, { rule }, 'Dynamic pricing rule updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/dynamic-pricing/:id/disable
 * Disable a dynamic pricing rule
 */
export const disableDynamicPricingRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable dynamic pricing rules', 403);
      return;
    }

    const { id } = req.params;

    // Find rule
    const rule = await DynamicPricingRule.findById(id);
    if (!rule) {
      sendError(res, 'Dynamic pricing rule not found', 404);
      return;
    }

    // Disable rule
    rule.status = 'inactive';
    await rule.save();

    // Populate for response
    await rule.populate('scopeId');
    await rule.populate('createdBy', 'name email');

    sendSuccess(res, { rule }, 'Dynamic pricing rule disabled successfully');
  } catch (error) {
    next(error);
  }
};

