import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MarkupRule } from '../models/MarkupRule';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { Category } from '../models/Category';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Markup Controller
 * 
 * PURPOSE:
 * - Admin-only markup rule management
 * - Create, read, update, disable markup rules
 * - Control system-wide markup constraints
 */

// Validation schemas
const createMarkupRuleSchema = z.object({
  scope: z.enum(['global', 'category', 'product', 'variant']),
  scopeId: z.string().nullable().optional(),
  minMarkupType: z.enum(['amount', 'percentage']),
  minMarkupValue: z.number().min(0),
  maxMarkupType: z.enum(['amount', 'percentage']).nullable().optional(),
  maxMarkupValue: z.number().min(0).nullable().optional(),
  appliesTo: z.array(z.enum(['reseller', 'store'])).min(1),
  priority: z.number().min(1).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateMarkupRuleSchema = z.object({
  minMarkupType: z.enum(['amount', 'percentage']).optional(),
  minMarkupValue: z.number().min(0).optional(),
  maxMarkupType: z.enum(['amount', 'percentage']).nullable().optional(),
  maxMarkupValue: z.number().min(0).nullable().optional(),
  appliesTo: z.array(z.enum(['reseller', 'store'])).min(1).optional(),
  priority: z.number().min(1).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * POST /admin/markup-rules
 * Create a new markup rule
 */
export const createMarkupRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create markup rules', 403);
      return;
    }

    // Validate request body
    const validatedData = createMarkupRuleSchema.parse(req.body);

    // Validate scopeId based on scope
    if (validatedData.scope === 'global' && validatedData.scopeId !== null && validatedData.scopeId !== undefined) {
      sendError(res, 'Global scope must have scopeId as null', 400);
      return;
    }

    if (validatedData.scope !== 'global' && !validatedData.scopeId) {
      sendError(res, `${validatedData.scope} scope must have a scopeId`, 400);
      return;
    }

    // Validate max markup >= min markup if both are percentages
    if (
      validatedData.minMarkupType === 'percentage' &&
      validatedData.maxMarkupType === 'percentage' &&
      validatedData.maxMarkupValue !== null &&
      validatedData.maxMarkupValue !== undefined &&
      validatedData.maxMarkupValue < validatedData.minMarkupValue
    ) {
      sendError(res, 'Maximum markup must be greater than or equal to minimum markup', 400);
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

    // Create markup rule
    const markupRule = new MarkupRule({
      scope: validatedData.scope,
      scopeId: validatedData.scopeId ? new mongoose.Types.ObjectId(validatedData.scopeId) : null,
      minMarkupType: validatedData.minMarkupType,
      minMarkupValue: validatedData.minMarkupValue,
      maxMarkupType: validatedData.maxMarkupType || null,
      maxMarkupValue: validatedData.maxMarkupValue || null,
      appliesTo: validatedData.appliesTo,
      priority: validatedData.priority || 50,
      status: validatedData.status || 'active',
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await markupRule.save();

    // Populate for response
    await markupRule.populate('scopeId');
    await markupRule.populate('createdBy', 'name email');

    sendSuccess(res, { rule: markupRule }, 'Markup rule created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/markup-rules
 * Get all markup rules
 */
export const getMarkupRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view markup rules', 403);
      return;
    }

    const { scope, appliesTo, status } = req.query;

    const filter: any = {};
    if (scope) filter.scope = scope;
    if (appliesTo) filter.appliesTo = appliesTo;
    if (status) filter.status = status;

    const rules = await MarkupRule.find(filter)
      .populate('scopeId', 'name slug')
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    sendSuccess(res, { rules }, 'Markup rules retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/markup-rules/:id
 * Update a markup rule
 */
export const updateMarkupRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update markup rules', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updateMarkupRuleSchema.parse(req.body);

    // Find markup rule
    const markupRule = await MarkupRule.findById(id);
    if (!markupRule) {
      sendError(res, 'Markup rule not found', 404);
      return;
    }

    // Validate max markup >= min markup if both are percentages
    const minMarkupType = validatedData.minMarkupType ?? markupRule.minMarkupType;
    const minMarkupValue = validatedData.minMarkupValue ?? markupRule.minMarkupValue;
    const maxMarkupType = validatedData.maxMarkupType ?? markupRule.maxMarkupType;
    const maxMarkupValue = validatedData.maxMarkupValue ?? markupRule.maxMarkupValue;

    if (
      minMarkupType === 'percentage' &&
      maxMarkupType === 'percentage' &&
      maxMarkupValue !== null &&
      maxMarkupValue !== undefined &&
      maxMarkupValue < minMarkupValue
    ) {
      sendError(res, 'Maximum markup must be greater than or equal to minimum markup', 400);
      return;
    }

    // Update markup rule
    Object.assign(markupRule, validatedData);
    await markupRule.save();

    // Populate for response
    await markupRule.populate('scopeId');
    await markupRule.populate('createdBy', 'name email');

    sendSuccess(res, { rule: markupRule }, 'Markup rule updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/markup-rules/:id/disable
 * Disable a markup rule
 */
export const disableMarkupRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable markup rules', 403);
      return;
    }

    const { id } = req.params;

    // Find markup rule
    const markupRule = await MarkupRule.findById(id);
    if (!markupRule) {
      sendError(res, 'Markup rule not found', 404);
      return;
    }

    // Disable rule (instant effect)
    markupRule.status = 'inactive';
    await markupRule.save();

    sendSuccess(res, { rule: markupRule }, 'Markup rule disabled successfully');
  } catch (error) {
    next(error);
  }
};

