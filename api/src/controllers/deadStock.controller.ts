import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { DeadStockRule } from '../models/DeadStockRule';
import { DeadStockAlert } from '../models/DeadStockAlert';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Dead Stock Alert Controller
 * 
 * Handles:
 * - Viewing dead stock alerts
 * - Acknowledging alerts
 * - Resolving alerts
 * - Viewing rules
 * - Creating/updating rules
 * - Analytics and metrics
 */

function getScopeAndEntity(user: any, storeId?: mongoose.Types.ObjectId | string): {
  scope: 'admin' | 'supplier' | 'reseller';
  entityId: mongoose.Types.ObjectId | string | null;
} {
  if (!user) throw new Error('User not authenticated');
  const userRole = user.role;
  if (userRole === 'admin') return { scope: 'admin', entityId: null };
  if (userRole === 'reseller') {
    const resellerId = user.id?.toString() || storeId?.toString() || '';
    return { scope: 'reseller', entityId: resellerId };
  }
  if (userRole === 'supplier') {
    const supplierId = user.id?.toString() || '';
    return { scope: 'supplier', entityId: supplierId ? new mongoose.Types.ObjectId(supplierId) : null };
  }
  throw new Error('Invalid user role');
}

/**
 * GET /dead-stock-alerts
 * Get dead stock alerts
 */
export const getDeadStockAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);
    const { status, severity, limit = 50, skip = 0 } = req.query;

    const query: any = {
      storeId,
      scope,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    if (status) query.status = status;
    if (severity) query.severity = severity;

    const alerts = await DeadStockAlert.find(query)
      .populate('skuId', 'sku attributes')
      .populate('productId', 'name')
      .sort({ severity: -1, daysSinceLastSale: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    const total = await DeadStockAlert.countDocuments(query);

    // Calculate metrics
    const openAlerts = await DeadStockAlert.countDocuments({ ...query, status: 'open' });
    const criticalAlerts = await DeadStockAlert.countDocuments({ ...query, severity: 'critical', status: { $in: ['open', 'acknowledged'] } });
    const totalStockValue = await DeadStockAlert.aggregate([
      { $match: { ...query, status: { $in: ['open', 'acknowledged'] } } },
      { $group: { _id: null, total: { $sum: '$stockValue' } } },
    ]);

    await logAudit({
      action: 'DEAD_STOCK_ALERTS_VIEWED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'DeadStockAlert',
      entityId: storeId.toString(),
      description: `Viewed dead stock alerts (scope: ${scope}, status: ${status || 'all'}, severity: ${severity || 'all'})`,
      metadata: { scope, status, severity },
    });

    sendSuccess(res, {
      alerts,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
      },
      metrics: {
        openAlerts,
        criticalAlerts,
        totalStockValueAtRisk: totalStockValue[0]?.total || 0,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /dead-stock-alerts/:id
 * Get single dead stock alert
 */
export const getDeadStockAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    const alertId = req.params.id;

    if (!currentUser || !storeId || !alertId) {
      sendError(res, 'Authentication, store, and alert ID required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const query: any = {
      _id: new mongoose.Types.ObjectId(alertId),
      storeId,
      scope,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const alert = await DeadStockAlert.findOne(query)
      .populate('skuId', 'sku attributes basePrice images')
      .populate('productId', 'name description images')
      .populate('ruleId', 'daysWithoutSales minStockThreshold severity')
      .lean();

    if (!alert) {
      sendError(res, 'Alert not found or access denied', 404);
      return;
    }

    sendSuccess(res, { alert });
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /dead-stock-alerts/:id/acknowledge
 * Acknowledge a dead stock alert
 */
export const acknowledgeDeadStockAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    const alertId = req.params.id;
    const { internalNote } = req.body;

    if (!currentUser || !storeId || !alertId) {
      sendError(res, 'Authentication, store, and alert ID required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const query: any = {
      _id: new mongoose.Types.ObjectId(alertId),
      storeId,
      scope,
      status: 'open',
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const alert = await DeadStockAlert.findOneAndUpdate(
      query,
      {
        $set: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedBy: currentUser.id || currentUser.userId,
          internalNote: internalNote || undefined,
        },
      },
      { new: true }
    ).lean();

    if (!alert) {
      sendError(res, 'Alert not found, already acknowledged, or access denied', 404);
      return;
    }

    await logAudit({
      action: 'DEAD_STOCK_ALERT_ACKNOWLEDGED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'DeadStockAlert',
      entityId: alertId,
      description: `Acknowledged dead stock alert for SKU ${alert.skuId.toString()}`,
      metadata: { scope, skuId: alert.skuId.toString() },
    });

    sendSuccess(res, { alert }, 'Alert acknowledged successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /dead-stock-alerts/:id/resolve
 * Resolve a dead stock alert
 */
export const resolveDeadStockAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    const alertId = req.params.id;
    const { resolutionReason } = req.body;

    if (!currentUser || !storeId || !alertId) {
      sendError(res, 'Authentication, store, and alert ID required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const query: any = {
      _id: new mongoose.Types.ObjectId(alertId),
      storeId,
      scope,
      status: { $in: ['open', 'acknowledged'] },
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const alert = await DeadStockAlert.findOneAndUpdate(
      query,
      {
        $set: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: currentUser.id || currentUser.userId,
          resolutionReason: resolutionReason || 'Manually resolved',
        },
      },
      { new: true }
    ).lean();

    if (!alert) {
      sendError(res, 'Alert not found, already resolved, or access denied', 404);
      return;
    }

    await logAudit({
      action: 'DEAD_STOCK_ALERT_RESOLVED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'DeadStockAlert',
      entityId: alertId,
      description: `Resolved dead stock alert for SKU ${alert.skuId.toString()}`,
      metadata: { scope, skuId: alert.skuId.toString(), resolutionReason },
    });

    sendSuccess(res, { alert }, 'Alert resolved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /dead-stock-rules
 * Get dead stock rules
 */
export const getDeadStockRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const query: any = {
      storeId,
      scope,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const rules = await DeadStockRule.find(query).sort({ createdAt: -1 }).lean();

    sendSuccess(res, { rules });
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /dead-stock-rules
 * Create or update dead stock rule
 */
export const createOrUpdateDeadStockRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const ruleSchema = z.object({
      daysWithoutSales: z.number().min(1).max(365),
      minStockThreshold: z.number().min(0),
      velocityThreshold: z.number().min(0).optional(),
      maxStockAgingDays: z.number().min(0).optional(),
      severity: z.enum(['warning', 'critical']),
      isActive: z.boolean(),
    });

    const validated = ruleSchema.parse(req.body);

    // Check if active rule exists
    const existingRuleQuery: any = {
      storeId,
      scope,
      isActive: true,
    };

    if (entityId !== null) existingRuleQuery.entityId = entityId;
    else existingRuleQuery.entityId = null;

    const existingRule = await DeadStockRule.findOne(existingRuleQuery).lean();

    if (existingRule && validated.isActive) {
      // Update existing rule
      const updated = await DeadStockRule.findByIdAndUpdate(
        existingRule._id,
        {
          $set: validated,
        },
        { new: true }
      ).lean();

      sendSuccess(res, { rule: updated }, 'Rule updated successfully');
    } else {
      // Deactivate existing rule if new one is active
      if (existingRule && validated.isActive) {
        await DeadStockRule.findByIdAndUpdate(existingRule._id, { $set: { isActive: false } });
      }

      // Create new rule
      const rule = await DeadStockRule.create({
        storeId,
        scope,
        entityId: entityId || null,
        ...validated,
      });

      sendSuccess(res, { rule }, 'Rule created successfully');
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /dead-stock-analytics
 * Get dead stock analytics and metrics
 */
export const getDeadStockAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const query: any = {
      storeId,
      scope,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    // Get all alerts for metrics
    const allAlerts = await DeadStockAlert.find(query).lean();
    const openAlerts = allAlerts.filter((a) => a.status === 'open' || a.status === 'acknowledged');
    const resolvedAlerts = allAlerts.filter((a) => a.status === 'resolved');

    // Calculate metrics
    const totalStockValueAtRisk = openAlerts.reduce((sum, a) => sum + (a.stockValue || 0), 0);
    const criticalStockValue = openAlerts
      .filter((a) => a.severity === 'critical')
      .reduce((sum, a) => sum + (a.stockValue || 0), 0);

    // Calculate recovery rate (alerts resolved in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentResolved = resolvedAlerts.filter((a) => a.resolvedAt && a.resolvedAt >= thirtyDaysAgo);
    const recoveryRate = allAlerts.length > 0 ? (recentResolved.length / allAlerts.length) * 100 : 0;

    // Calculate average time to resolution
    const resolvedWithTime = resolvedAlerts.filter((a) => a.resolvedAt && a.createdAt);
    const avgTimeToResolution =
      resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, a) => {
            const timeDiff = a.resolvedAt!.getTime() - a.createdAt.getTime();
            return sum + timeDiff / (1000 * 60 * 60 * 24); // Convert to days
          }, 0) / resolvedWithTime.length
        : 0;

    // Get total inventory value (from open alerts)
    const totalInventoryValue = openAlerts.reduce((sum, a) => sum + (a.stockValue || 0), 0);
    const inventoryAtRiskPercent = totalInventoryValue > 0 ? (totalStockValueAtRisk / totalInventoryValue) * 100 : 0;

    sendSuccess(res, {
      metrics: {
        totalAlerts: allAlerts.length,
        openAlerts: openAlerts.length,
        criticalAlerts: openAlerts.filter((a) => a.severity === 'critical').length,
        resolvedAlerts: resolvedAlerts.length,
        totalStockValueAtRisk,
        criticalStockValue,
        recoveryRate: Math.round(recoveryRate * 100) / 100,
        avgTimeToResolution: Math.round(avgTimeToResolution * 100) / 100,
        inventoryAtRiskPercent: Math.round(inventoryAtRiskPercent * 100) / 100,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

