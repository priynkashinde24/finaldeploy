import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { ThrottleRule, IThrottleRule } from '../models/ThrottleRule';
import { ThrottleLog } from '../models/ThrottleLog';
import { getThrottleStats, clearThrottleCache } from '../services/throttling.service';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Throttling Controller
 * 
 * PURPOSE:
 * - Manage throttling rules
 * - View throttling statistics
 * - Monitor throttling logs
 */

const createThrottleRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  strategy: z.enum(['sliding-window', 'token-bucket', 'leaky-bucket', 'fixed-window']),
  scope: z.enum(['global', 'user', 'ip', 'endpoint', 'user-endpoint', 'ip-endpoint']),
  maxRequests: z.number().min(1),
  windowMs: z.number().min(1000),
  bucketSize: z.number().min(1).optional(),
  refillRate: z.number().min(0.1).optional(),
  blockDuration: z.number().min(0).optional(),
  endpointPattern: z.string().optional(),
  userRoles: z.array(z.string()).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  ipBlacklist: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  priority: z.number().optional(),
});

const updateThrottleRuleSchema = createThrottleRuleSchema.partial();

/**
 * POST /api/admin/throttling/rules
 * Create a new throttling rule
 */
export const createThrottleRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createThrottleRuleSchema.parse(req.body);

    const rule = new ThrottleRule({
      ...validatedData,
      storeId,
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
      active: validatedData.active !== undefined ? validatedData.active : true,
      priority: validatedData.priority || 0,
    });

    await rule.save();

    await logAudit({
      req,
      action: 'THROTTLE_RULE_CREATED',
      entityType: 'ThrottleRule',
      entityId: rule._id.toString(),
      description: `Throttle rule created: ${rule.name}`,
      metadata: {
        ruleId: rule._id.toString(),
        strategy: rule.strategy,
        scope: rule.scope,
      },
    });

    sendSuccess(res, {
      rule: {
        id: rule._id.toString(),
        name: rule.name,
        strategy: rule.strategy,
        scope: rule.scope,
        maxRequests: rule.maxRequests,
        windowMs: rule.windowMs,
        active: rule.active,
      },
    }, 'Throttle rule created');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /api/admin/throttling/rules
 * List throttling rules
 */
export const listThrottleRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { active, limit = 50, page = 1 } = req.query;

    const filter: any = {};
    if (storeId) {
      filter.storeId = storeId;
    }
    if (active !== undefined) {
      filter.active = active === 'true';
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const rules = await ThrottleRule.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    const total = await ThrottleRule.countDocuments(filter);

    sendSuccess(
      res,
      {
        rules: rules.map((rule) => ({
          id: rule._id.toString(),
          name: rule.name,
          description: rule.description,
          strategy: rule.strategy,
          scope: rule.scope,
          maxRequests: rule.maxRequests,
          windowMs: rule.windowMs,
          active: rule.active,
          priority: rule.priority,
          createdAt: rule.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Rules retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/admin/throttling/rules/:ruleId
 * Get throttling rule details
 */
export const getThrottleRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { ruleId } = req.params;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const rule = await ThrottleRule.findById(ruleId);

    if (!rule) {
      sendError(res, 'Throttle rule not found', 404);
      return;
    }

    sendSuccess(res, {
      rule: {
        id: rule._id.toString(),
        name: rule.name,
        description: rule.description,
        strategy: rule.strategy,
        scope: rule.scope,
        maxRequests: rule.maxRequests,
        windowMs: rule.windowMs,
        bucketSize: rule.bucketSize,
        refillRate: rule.refillRate,
        blockDuration: rule.blockDuration,
        endpointPattern: rule.endpointPattern,
        userRoles: rule.userRoles,
        ipWhitelist: rule.ipWhitelist,
        ipBlacklist: rule.ipBlacklist,
        active: rule.active,
        priority: rule.priority,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      },
    }, 'Rule retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * PUT /api/admin/throttling/rules/:ruleId
 * Update throttling rule
 */
export const updateThrottleRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { ruleId } = req.params;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = updateThrottleRuleSchema.parse(req.body);

    const rule = await ThrottleRule.findById(ruleId);

    if (!rule) {
      sendError(res, 'Throttle rule not found', 404);
      return;
    }

    Object.assign(rule, validatedData);
    await rule.save();

    // Clear cache for this rule
    clearThrottleCache();

    await logAudit({
      req,
      action: 'THROTTLE_RULE_UPDATED',
      entityType: 'ThrottleRule',
      entityId: rule._id.toString(),
      description: `Throttle rule updated: ${rule.name}`,
      metadata: {
        changes: Object.keys(validatedData),
      },
    });

    sendSuccess(res, {
      rule: {
        id: rule._id.toString(),
        name: rule.name,
        active: rule.active,
      },
    }, 'Rule updated');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * DELETE /api/admin/throttling/rules/:ruleId
 * Delete throttling rule
 */
export const deleteThrottleRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { ruleId } = req.params;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const rule = await ThrottleRule.findById(ruleId);

    if (!rule) {
      sendError(res, 'Throttle rule not found', 404);
      return;
    }

    await rule.deleteOne();

    await logAudit({
      req,
      action: 'THROTTLE_RULE_DELETED',
      entityType: 'ThrottleRule',
      entityId: ruleId,
      description: `Throttle rule deleted: ${rule.name}`,
    });

    sendSuccess(res, {}, 'Rule deleted');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/admin/throttling/stats
 * Get throttling statistics
 */
export const getThrottlingStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { ruleId, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const stats = await getThrottleStats(
      ruleId as string | undefined,
      start,
      end
    );

    sendSuccess(res, { stats }, 'Statistics retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/admin/throttling/logs
 * Get throttling logs
 */
export const getThrottlingLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const {
      ruleId,
      allowed,
      scope,
      identifier,
      ipAddress,
      startDate,
      endDate,
      limit = 100,
      page = 1,
    } = req.query;

    const filter: any = {};

    if (ruleId) {
      filter.ruleId = new mongoose.Types.ObjectId(ruleId as string);
    }
    if (allowed !== undefined) {
      filter.allowed = allowed === 'true';
    }
    if (scope) {
      filter.scope = scope;
    }
    if (identifier) {
      filter.identifier = identifier;
    }
    if (ipAddress) {
      filter.ipAddress = ipAddress;
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const logs = await ThrottleLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    const total = await ThrottleLog.countDocuments(filter);

    sendSuccess(
      res,
      {
        logs: logs.map((log) => ({
          id: log._id.toString(),
          ruleId: log.ruleId?.toString(),
          scope: log.scope,
          identifier: log.identifier,
          allowed: log.allowed,
          remaining: log.remaining,
          ipAddress: log.ipAddress,
          endpoint: log.endpoint,
          retryAfter: log.retryAfter,
          reason: log.reason,
          createdAt: log.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Logs retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

