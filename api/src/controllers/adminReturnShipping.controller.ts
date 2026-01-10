import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { ReturnShippingRule } from '../models/ReturnShippingRule';

/**
 * Admin Return Shipping Rules Controller
 *
 * PURPOSE:
 * - CRUD operations for return shipping rules
 * - Admin-only access
 * - Rule validation
 */

// Validation schemas
const createRuleSchema = z.object({
  scope: z.enum(['sku', 'category', 'global']),
  skuId: z.string().optional(),
  categoryId: z.string().optional(),
  returnReason: z.array(z.string()).min(1),
  condition: z.array(z.enum(['sealed', 'opened', 'damaged'])).min(1),
  payer: z.enum(['customer', 'supplier', 'reseller', 'platform']),
  chargeType: z.enum(['flat', 'percentage', 'actual_shipping']),
  chargeValue: z.number().min(0),
  priority: z.number().int().min(1).optional(),
  description: z.string().optional(),
});

const updateRuleSchema = createRuleSchema.partial();

/**
 * POST /admin/return-shipping-rules
 * Create return shipping rule
 */
export const createReturnShippingRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createRuleSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Validate scope-specific fields
    if (validatedData.scope === 'sku' && !validatedData.skuId) {
      sendError(res, 'skuId is required when scope is "sku"', 400);
      return;
    }
    if (validatedData.scope === 'category' && !validatedData.categoryId) {
      sendError(res, 'categoryId is required when scope is "category"', 400);
      return;
    }
    if (validatedData.scope === 'global' && (validatedData.skuId || validatedData.categoryId)) {
      sendError(res, 'skuId and categoryId must be null when scope is "global"', 400);
      return;
    }

    const rule = new ReturnShippingRule({
      storeId: storeObjId,
      scope: validatedData.scope,
      skuId: validatedData.skuId ? new mongoose.Types.ObjectId(validatedData.skuId) : null,
      categoryId: validatedData.categoryId
        ? new mongoose.Types.ObjectId(validatedData.categoryId)
        : null,
      returnReason: validatedData.returnReason,
      condition: validatedData.condition,
      payer: validatedData.payer,
      chargeType: validatedData.chargeType,
      chargeValue: validatedData.chargeValue,
      priority: validatedData.priority || 999,
      description: validatedData.description,
      isActive: true,
    });

    await rule.save();

    // Audit log
    await import('../utils/auditLogger').then(({ logAudit }) =>
      logAudit({
        req,
        action: 'RETURN_SHIPPING_RULE_CREATED',
        entityType: 'ReturnShippingRule',
        entityId: rule._id.toString(),
        description: `Return shipping rule created: ${validatedData.scope} scope, ${validatedData.payer} pays`,
        metadata: {
          scope: validatedData.scope,
          payer: validatedData.payer,
          chargeType: validatedData.chargeType,
          chargeValue: validatedData.chargeValue,
        },
      })
    );

    sendSuccess(res, {
      rule,
      message: 'Return shipping rule created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/return-shipping-rules
 * List return shipping rules
 */
export const listReturnShippingRules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const { scope, isActive, page = 1, limit = 20 } = req.query;

    const filter: any = { storeId: storeObjId };

    if (scope) {
      filter.scope = scope;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rules, total] = await Promise.all([
      ReturnShippingRule.find(filter)
        .sort({ scope: 1, priority: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('skuId', 'sku name')
        .populate('categoryId', 'name slug')
        .lean(),
      ReturnShippingRule.countDocuments(filter),
    ]);

    sendSuccess(res, {
      rules,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /admin/return-shipping-rules/:id
 * Get return shipping rule
 */
export const getReturnShippingRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { id } = req.params;
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const rule = await ReturnShippingRule.findOne({
      _id: id,
      storeId: storeObjId,
    })
      .populate('skuId', 'sku name')
      .populate('categoryId', 'name slug')
      .lean();

    if (!rule) {
      sendError(res, 'Return shipping rule not found', 404);
      return;
    }

    sendSuccess(res, { rule });
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /admin/return-shipping-rules/:id
 * Update return shipping rule
 */
export const updateReturnShippingRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { id } = req.params;
    const validatedData = updateRuleSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const rule = await ReturnShippingRule.findOne({
      _id: id,
      storeId: storeObjId,
    });

    if (!rule) {
      sendError(res, 'Return shipping rule not found', 404);
      return;
    }

    // Update fields
    if (validatedData.scope !== undefined) rule.scope = validatedData.scope;
    if (validatedData.skuId !== undefined)
      rule.skuId = validatedData.skuId ? new mongoose.Types.ObjectId(validatedData.skuId) : undefined;
    if (validatedData.categoryId !== undefined)
      rule.categoryId = validatedData.categoryId
        ? new mongoose.Types.ObjectId(validatedData.categoryId)
        : undefined;
    if (validatedData.returnReason !== undefined) rule.returnReason = validatedData.returnReason;
    if (validatedData.condition !== undefined) rule.condition = validatedData.condition;
    if (validatedData.payer !== undefined) rule.payer = validatedData.payer;
    if (validatedData.chargeType !== undefined) rule.chargeType = validatedData.chargeType;
    if (validatedData.chargeValue !== undefined) rule.chargeValue = validatedData.chargeValue;
    if (validatedData.priority !== undefined) rule.priority = validatedData.priority;
    if (validatedData.description !== undefined) rule.description = validatedData.description;

    await rule.save();

    // Audit log
    await import('../utils/auditLogger').then(({ logAudit }) =>
      logAudit({
        req,
        action: 'RETURN_SHIPPING_RULE_UPDATED',
        entityType: 'ReturnShippingRule',
        entityId: rule._id.toString(),
        description: `Return shipping rule updated`,
        metadata: validatedData,
      })
    );

    sendSuccess(res, {
      rule,
      message: 'Return shipping rule updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400);
      return;
    }
    next(error);
  }
};

/**
 * DELETE /admin/return-shipping-rules/:id
 * Delete return shipping rule (soft delete by setting isActive = false)
 */
export const deleteReturnShippingRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { id } = req.params;
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const rule = await ReturnShippingRule.findOne({
      _id: id,
      storeId: storeObjId,
    });

    if (!rule) {
      sendError(res, 'Return shipping rule not found', 404);
      return;
    }

    // Soft delete
    rule.isActive = false;
    await rule.save();

    // Audit log
    await import('../utils/auditLogger').then(({ logAudit }) =>
      logAudit({
        req,
        action: 'RETURN_SHIPPING_RULE_DELETED',
        entityType: 'ReturnShippingRule',
        entityId: rule._id.toString(),
        description: `Return shipping rule deleted (deactivated)`,
      })
    );

    sendSuccess(res, {
      message: 'Return shipping rule deleted successfully',
    });
  } catch (error: any) {
    next(error);
  }
};

