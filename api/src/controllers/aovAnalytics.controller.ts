import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { AOVSnapshot } from '../models/AOVSnapshot';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * AOV Analytics Controller
 * 
 * PURPOSE:
 * - Provide Average Order Value insights
 * - Support Admin, Reseller, and Supplier views
 * - Use pre-aggregated snapshot data for performance
 * - Role-based data scoping
 * 
 * RULES:
 * - All queries use snapshot data (no real-time aggregation)
 * - Role-based access control enforced
 * - No cross-entity data leakage
 */

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
});

/**
 * Get scope and entityId based on user role
 */
function getScopeAndEntity(user: any, storeId?: mongoose.Types.ObjectId | string): {
  scope: 'admin' | 'reseller' | 'supplier';
  entityId: mongoose.Types.ObjectId | string | null;
} {
  if (!user) {
    throw new Error('User not authenticated');
  }

  const userRole = user.role;

  if (userRole === 'admin') {
    return { scope: 'admin', entityId: null };
  }

  if (userRole === 'reseller') {
    const resellerId = user.id?.toString() || storeId?.toString() || '';
    return { scope: 'reseller', entityId: resellerId };
  }

  if (userRole === 'supplier') {
    const supplierId = user.id?.toString() || '';
    return { scope: 'supplier', entityId: supplierId ? new mongoose.Types.ObjectId(supplierId) : null };
  }

  throw new Error('Invalid user role for AOV analytics');
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /analytics/aov/summary
 * Get AOV summary KPIs
 */
export const getAOVSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    // Get scope and entity
    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    // Parse query params
    const { startDate, endDate } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    // Validate dates
    try {
      dateRangeSchema.parse({ startDate: start, endDate: end });
    } catch (error: any) {
      sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      return;
    }

    // Build query
    const query: any = {
      storeId,
      scope,
      date: { $gte: start, $lte: end },
    };

    if (entityId !== null) {
      query.entityId = entityId;
    } else {
      query.entityId = null;
    }

    // Get snapshots
    const snapshots = await AOVSnapshot.find(query).sort({ date: 1 }).lean();

    // Aggregate totals
    let totalOrders = 0;
    let totalGrossRevenue = 0;
    let totalNetRevenue = 0;
    let totalRefunds = 0;
    let totalOnlineOrders = 0;
    let totalCodOrders = 0;
    let totalStripeOrders = 0;
    let totalStripeRevenue = 0;
    let totalPaypalOrders = 0;
    let totalPaypalRevenue = 0;
    let totalCodRevenue = 0;
    let totalSupplierRevenue = 0;

    for (const snapshot of snapshots) {
      totalOrders += snapshot.ordersCount || 0;
      totalGrossRevenue += snapshot.grossRevenue || 0;
      totalNetRevenue += snapshot.netRevenue || 0;
      totalRefunds += snapshot.refunds || 0;
      totalOnlineOrders += snapshot.onlineOrdersCount || 0;
      totalCodOrders += snapshot.codOrdersCount || 0;
      totalStripeOrders += snapshot.stripeOrdersCount || 0;
      totalStripeRevenue += snapshot.stripeRevenue || 0;
      totalPaypalOrders += snapshot.paypalOrdersCount || 0;
      totalPaypalRevenue += snapshot.paypalRevenue || 0;
      totalCodRevenue += snapshot.codRevenue || 0;
      totalSupplierRevenue += snapshot.supplierRevenue || 0;
    }

    // Calculate AOV values
    const grossAOV = totalOrders > 0 ? totalGrossRevenue / totalOrders : 0;
    const netAOV = totalOrders > 0 ? totalNetRevenue / totalOrders : 0;
    const onlineAOV = totalOnlineOrders > 0 ? (totalStripeRevenue + totalPaypalRevenue) / totalOnlineOrders : 0;
    const codAOV = totalCodOrders > 0 ? totalCodRevenue / totalCodOrders : 0;
    const stripeAOV = totalStripeOrders > 0 ? totalStripeRevenue / totalStripeOrders : 0;
    const paypalAOV = totalPaypalOrders > 0 ? totalPaypalRevenue / totalPaypalOrders : 0;
    const supplierAOV = totalOrders > 0 ? totalSupplierRevenue / totalOrders : 0;

    // Refund impact percentage
    const refundImpact = totalGrossRevenue > 0 ? (totalRefunds / totalGrossRevenue) * 100 : 0;

    // Get comparison data (previous period)
    const periodDays = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = formatDate(new Date(new Date(start).getTime() - periodDays * 24 * 60 * 60 * 1000));
    const prevEnd = formatDate(new Date(new Date(end).getTime() - periodDays * 24 * 60 * 60 * 1000));

    const prevQuery = { ...query, date: { $gte: prevStart, $lte: prevEnd } };
    const prevSnapshots = await AOVSnapshot.find(prevQuery).sort({ date: 1 }).lean();

    let prevTotalOrders = 0;
    let prevTotalGrossRevenue = 0;
    let prevTotalNetRevenue = 0;
    let prevTotalRefunds = 0;

    for (const snapshot of prevSnapshots) {
      prevTotalOrders += snapshot.ordersCount || 0;
      prevTotalGrossRevenue += snapshot.grossRevenue || 0;
      prevTotalNetRevenue += snapshot.netRevenue || 0;
      prevTotalRefunds += snapshot.refunds || 0;
    }

    const prevGrossAOV = prevTotalOrders > 0 ? prevTotalGrossRevenue / prevTotalOrders : 0;
    const prevNetAOV = prevTotalOrders > 0 ? prevTotalNetRevenue / prevTotalOrders : 0;
    const prevRefundImpact = prevTotalGrossRevenue > 0 ? (prevTotalRefunds / prevTotalGrossRevenue) * 100 : 0;

    // Calculate changes
    const grossAOVChange = prevGrossAOV > 0 ? ((grossAOV - prevGrossAOV) / prevGrossAOV) * 100 : 0;
    const netAOVChange = prevNetAOV > 0 ? ((netAOV - prevNetAOV) / prevNetAOV) * 100 : 0;
    const refundImpactChange = prevRefundImpact > 0 ? refundImpact - prevRefundImpact : 0;

    // Log audit
    await logAudit({
      action: 'AOV_ANALYTICS_VIEWED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'aov_analytics',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'AOV analytics viewed',
      metadata: {
        scope,
        entityId: entityId?.toString() || null,
        dateRange: { start, end },
      },
    });

    sendSuccess(res, {
      summary: {
        grossAOV: Math.round(grossAOV * 100) / 100,
        netAOV: Math.round(netAOV * 100) / 100,
        onlineAOV: Math.round(onlineAOV * 100) / 100,
        codAOV: Math.round(codAOV * 100) / 100,
        stripeAOV: Math.round(stripeAOV * 100) / 100,
        paypalAOV: Math.round(paypalAOV * 100) / 100,
        supplierAOV: scope === 'supplier' ? Math.round(supplierAOV * 100) / 100 : null,
        refundImpact: Math.round(refundImpact * 100) / 100,
        totalOrders,
        totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
        totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
      },
      comparison: {
        grossAOV: {
          current: Math.round(grossAOV * 100) / 100,
          previous: Math.round(prevGrossAOV * 100) / 100,
          change: Math.round(grossAOVChange * 100) / 100,
          changePercent: Math.round(grossAOVChange * 100) / 100,
        },
        netAOV: {
          current: Math.round(netAOV * 100) / 100,
          previous: Math.round(prevNetAOV * 100) / 100,
          change: Math.round(netAOVChange * 100) / 100,
          changePercent: Math.round(netAOVChange * 100) / 100,
        },
        refundImpact: {
          current: Math.round(refundImpact * 100) / 100,
          previous: Math.round(prevRefundImpact * 100) / 100,
          change: Math.round(refundImpactChange * 100) / 100,
        },
      },
      dateRange: { start, end },
      previousDateRange: { start: prevStart, end: prevEnd },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/aov/timeseries
 * Get AOV time series data
 */
export const getAOVTimeseries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    // Get scope and entity
    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    // Parse query params
    const { startDate, endDate, granularity = 'daily' } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    // Validate dates
    try {
      dateRangeSchema.parse({ startDate: start, endDate: end });
    } catch (error: any) {
      sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      return;
    }

    // Build query
    const query: any = {
      storeId,
      scope,
      date: { $gte: start, $lte: end },
    };

    if (entityId !== null) {
      query.entityId = entityId;
    } else {
      query.entityId = null;
    }

    // Get snapshots
    const snapshots = await AOVSnapshot.find(query).sort({ date: 1 }).lean();

    // Format response based on granularity
    const timeseries = snapshots.map((snapshot) => ({
      date: snapshot.date,
      grossAOV: Math.round((snapshot.grossAOV || 0) * 100) / 100,
      netAOV: Math.round((snapshot.netAOV || 0) * 100) / 100,
      onlineAOV: Math.round((snapshot.onlineAOV || 0) * 100) / 100,
      codAOV: Math.round((snapshot.codAOV || 0) * 100) / 100,
      stripeAOV: Math.round((snapshot.stripeAOV || 0) * 100) / 100,
      paypalAOV: Math.round((snapshot.paypalAOV || 0) * 100) / 100,
      supplierAOV: scope === 'supplier' ? Math.round((snapshot.supplierAOV || 0) * 100) / 100 : null,
      ordersCount: snapshot.ordersCount || 0,
      grossRevenue: Math.round((snapshot.grossRevenue || 0) * 100) / 100,
      netRevenue: Math.round((snapshot.netRevenue || 0) * 100) / 100,
      refunds: Math.round((snapshot.refunds || 0) * 100) / 100,
    }));

    // Log audit
    await logAudit({
      action: 'AOV_ANALYTICS_VIEWED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'aov_analytics',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'AOV analytics viewed',
      metadata: {
        scope,
        entityId: entityId?.toString() || null,
        dateRange: { start, end },
        granularity,
      },
    });

    sendSuccess(res, {
      timeseries,
      dateRange: { start, end },
      granularity,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/aov/breakdown
 * Get AOV breakdown by payment method, category, or customer type
 */
export const getAOVBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    // Get scope and entity
    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    // Parse query params
    const { startDate, endDate, breakdownBy = 'paymentMethod' } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    // Validate dates
    try {
      dateRangeSchema.parse({ startDate: start, endDate: end });
    } catch (error: any) {
      sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      return;
    }

    // Build query
    const query: any = {
      storeId,
      scope,
      date: { $gte: start, $lte: end },
    };

    if (entityId !== null) {
      query.entityId = entityId;
    } else {
      query.entityId = null;
    }

    // Get snapshots
    const snapshots = await AOVSnapshot.find(query).sort({ date: 1 }).lean();

    // Build breakdown based on breakdownBy parameter
    let breakdown: any = {};

    if (breakdownBy === 'paymentMethod') {
      let totalStripeOrders = 0;
      let totalStripeRevenue = 0;
      let totalPaypalOrders = 0;
      let totalPaypalRevenue = 0;
      let totalCodOrders = 0;
      let totalCodRevenue = 0;

      for (const snapshot of snapshots) {
        totalStripeOrders += snapshot.stripeOrdersCount || 0;
        totalStripeRevenue += snapshot.stripeRevenue || 0;
        totalPaypalOrders += snapshot.paypalOrdersCount || 0;
        totalPaypalRevenue += snapshot.paypalRevenue || 0;
        totalCodOrders += snapshot.codOrdersCount || 0;
        totalCodRevenue += snapshot.codRevenue || 0;
      }

      breakdown = {
        stripe: {
          ordersCount: totalStripeOrders,
          revenue: Math.round(totalStripeRevenue * 100) / 100,
          aov: totalStripeOrders > 0 ? Math.round((totalStripeRevenue / totalStripeOrders) * 100) / 100 : 0,
        },
        paypal: {
          ordersCount: totalPaypalOrders,
          revenue: Math.round(totalPaypalRevenue * 100) / 100,
          aov: totalPaypalOrders > 0 ? Math.round((totalPaypalRevenue / totalPaypalOrders) * 100) / 100 : 0,
        },
        cod: {
          ordersCount: totalCodOrders,
          revenue: Math.round(totalCodRevenue * 100) / 100,
          aov: totalCodOrders > 0 ? Math.round((totalCodRevenue / totalCodOrders) * 100) / 100 : 0,
        },
      };
    } else {
      // For category and customerType breakdowns, we'd need to query orders directly
      // For now, return a placeholder structure
      breakdown = {
        message: 'Category and customer type breakdowns require order-level data. Coming soon.',
      };
    }

    // Log audit
    await logAudit({
      action: 'AOV_ANALYTICS_VIEWED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'aov_analytics',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'AOV analytics viewed',
      metadata: {
        scope,
        entityId: entityId?.toString() || null,
        dateRange: { start, end },
        breakdownBy,
      },
    });

    sendSuccess(res, {
      breakdown,
      breakdownBy,
      dateRange: { start, end },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/aov/export
 * Export AOV data as CSV
 */
export const exportAOVAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    // Get scope and entity
    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    // Parse query params
    const { startDate, endDate } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    // Validate dates
    try {
      dateRangeSchema.parse({ startDate: start, endDate: end });
    } catch (error: any) {
      sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      return;
    }

    // Build query
    const query: any = {
      storeId,
      scope,
      date: { $gte: start, $lte: end },
    };

    if (entityId !== null) {
      query.entityId = entityId;
    } else {
      query.entityId = null;
    }

    // Get snapshots
    const snapshots = await AOVSnapshot.find(query).sort({ date: 1 }).lean();

    // Generate CSV
    const csvRows: string[] = [];
    csvRows.push('Date,Orders Count,Gross Revenue,Net Revenue,Refunds,Gross AOV,Net AOV,Online AOV,COD AOV,Stripe AOV,PayPal AOV,Supplier AOV');

    for (const snapshot of snapshots) {
      const row = [
        snapshot.date,
        (snapshot.ordersCount || 0).toString(),
        (snapshot.grossRevenue || 0).toFixed(2),
        (snapshot.netRevenue || 0).toFixed(2),
        (snapshot.refunds || 0).toFixed(2),
        (snapshot.grossAOV || 0).toFixed(2),
        (snapshot.netAOV || 0).toFixed(2),
        (snapshot.onlineAOV || 0).toFixed(2),
        (snapshot.codAOV || 0).toFixed(2),
        (snapshot.stripeAOV || 0).toFixed(2),
        (snapshot.paypalAOV || 0).toFixed(2),
        scope === 'supplier' ? (snapshot.supplierAOV || 0).toFixed(2) : 'N/A',
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    // Log audit
    await logAudit({
      action: 'AOV_ANALYTICS_EXPORTED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'aov_analytics',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'AOV analytics exported',
      metadata: {
        scope,
        entityId: entityId?.toString() || null,
        dateRange: { start, end },
      },
    });

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="aov-analytics-${start}-${end}.csv"`);
    res.send(csv);
  } catch (error: any) {
    next(error);
  }
};

