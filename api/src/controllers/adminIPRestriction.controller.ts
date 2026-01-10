import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { IPRestriction } from '../models/IPRestriction';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger';

const createSchema = z.object({
  storeId: z.string().optional().nullable(),
  scope: z.enum(['global', 'store', 'user', 'role']),
  scopeId: z.string().optional().nullable(),
  ruleType: z.enum(['allow', 'deny']),
  ipRange: z.string().min(1, 'IP range is required'),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  description: z.string().max(500).optional(),
});

const updateSchema = z.object({
  ruleType: z.enum(['allow', 'deny']).optional(),
  ipRange: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  description: z.string().max(500).optional(),
});

export const createIPRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can manage IP rules', 403);
      return;
    }

    const validated = createSchema.parse(req.body);

    const doc = new IPRestriction({
      storeId: validated.storeId ? new mongoose.Types.ObjectId(validated.storeId) : null,
      scope: validated.scope,
      scopeId: validated.scopeId || null,
      ruleType: validated.ruleType,
      ipRange: validated.ipRange,
      status: validated.status || 'active',
      description: validated.description,
      createdBy: currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : null,
    });

    await doc.save();

    await logAudit({
      req,
      action: 'IP_RULE_CREATED',
      entityType: 'IPRestriction',
      entityId: doc._id.toString(),
      after: doc.toObject(),
      description: 'IP restriction rule created',
      metadata: {
        ruleType: doc.ruleType,
        scope: doc.scope,
        ipRange: doc.ipRange,
      },
    });

    sendSuccess(res, { rule: doc }, 'IP rule created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

export const listIPRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view IP rules', 403);
      return;
    }

    const { storeId, scope, ruleType, status = 'active', page = '1', limit = '50' } = req.query;

    const filter: any = {};
    if (storeId) filter.storeId = storeId;
    if (scope) filter.scope = scope;
    if (ruleType) filter.ruleType = ruleType;
    if (status) filter.status = status;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [rules, total] = await Promise.all([
      IPRestriction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      IPRestriction.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      {
        rules,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'IP rules fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const updateIPRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update IP rules', 403);
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid rule ID', 400);
      return;
    }

    const validated = updateSchema.parse(req.body);
    const rule = await IPRestriction.findById(id);
    if (!rule) {
      sendError(res, 'Rule not found', 404);
      return;
    }

    const before = rule.toObject();
    Object.assign(rule, validated);
    await rule.save();

    await logAudit({
      req,
      action: 'IP_RULE_UPDATED',
      entityType: 'IPRestriction',
      entityId: rule._id.toString(),
      before,
      after: rule.toObject(),
      description: 'IP restriction rule updated',
      metadata: {
        ruleType: rule.ruleType,
        scope: rule.scope,
        ipRange: rule.ipRange,
      },
    });

    sendSuccess(res, { rule }, 'IP rule updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

export const disableIPRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable IP rules', 403);
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid rule ID', 400);
      return;
    }

    const rule = await IPRestriction.findById(id);
    if (!rule) {
      sendError(res, 'Rule not found', 404);
      return;
    }

    const before = rule.toObject();
    rule.status = 'inactive';
    await rule.save();

    await logAudit({
      req,
      action: 'IP_RULE_DISABLED',
      entityType: 'IPRestriction',
      entityId: rule._id.toString(),
      before,
      after: rule.toObject(),
      description: 'IP restriction rule disabled',
      metadata: {
        ruleType: rule.ruleType,
        scope: rule.scope,
        ipRange: rule.ipRange,
      },
    });

    sendSuccess(res, { rule }, 'IP rule disabled successfully');
  } catch (error) {
    next(error);
  }
};


