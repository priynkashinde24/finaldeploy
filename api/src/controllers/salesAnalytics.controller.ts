import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { SalesAnalyticsSnapshot } from '../models/SalesAnalyticsSnapshot';
import { Order } from '../models/Order';
import { RMA } from '../models/RMA';
import { CreditNote } from '../models/CreditNote';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Sales Analytics Controller
 * 
 * PURPOSE:
 * - Provide real-time and historical sales insights
 * - Support Admin, Supplier, Reseller views
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

const timeseriesSchema = z.object({
  metric: z.enum(['ordersCount', 'grossRevenue', 'netRevenue', 'taxCollected', 'shippingCollected', 'discounts', 'refunds', 'supplierEarnings', 'resellerEarnings', 'platformEarnings']),
  interval: z.enum(['day', 'week', 'month']).default('day'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Get scope and entityId based on user role
 */
function getScopeAndEntity(user: any, storeId?: mongoose.Types.ObjectId | string): {
  scope: 'admin' | 'supplier' | 'reseller';
  entityId: mongoose.Types.ObjectId | string | null;
} {
  if (!user) {
    throw new Error('User not authenticated');
  }

  const userRole = user.role;

  if (userRole === 'admin') {
    return { scope: 'admin', entityId: null };
  }

  if (userRole === 'supplier') {
    const supplierId = typeof user.id === 'string' ? new mongoose.Types.ObjectId(user.id) : user.id;
    return { scope: 'supplier', entityId: supplierId };
  }

  if (userRole === 'reseller') {
    // Reseller ID is typically the user ID or store owner ID
    const resellerId = user.id?.toString() || storeId?.toString() || '';
    return { scope: 'reseller', entityId: resellerId };
  }

  throw new Error('Invalid user role');
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
 * Get date range for interval grouping
 */
function getIntervalDates(startDate: string, endDate: string, interval: 'day' | 'week' | 'month'): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T00:00:00.000Z');

  if (interval === 'day') {
    let current = new Date(start);
    while (current <= end) {
      dates.push(formatDate(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else if (interval === 'week') {
    let current = new Date(start);
    // Start of week (Monday)
    const dayOfWeek = current.getUTCDay();
    const diff = current.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    current.setUTCDate(diff);
    while (current <= end) {
      dates.push(formatDate(current));
      current.setUTCDate(current.getUTCDate() + 7);
    }
  } else if (interval === 'month') {
    let current = new Date(start);
    current.setUTCDate(1); // First day of month
    while (current <= end) {
      dates.push(formatDate(current));
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  return dates;
}

/**
 * GET /analytics/summary
 * Get summary KPIs for date range
 */
export const getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const snapshots = await SalesAnalyticsSnapshot.find(query)
      .sort({ date: 1 })
      .lean();

    // Aggregate totals
    const totals = snapshots.reduce(
      (acc, snap) => ({
        ordersCount: acc.ordersCount + (snap.ordersCount || 0),
        grossRevenue: acc.grossRevenue + (snap.grossRevenue || 0),
        netRevenue: acc.netRevenue + (snap.netRevenue || 0),
        taxCollected: acc.taxCollected + (snap.taxCollected || 0),
        shippingCollected: acc.shippingCollected + (snap.shippingCollected || 0),
        discounts: acc.discounts + (snap.discounts || 0),
        refunds: acc.refunds + (snap.refunds || 0),
        codAmount: acc.codAmount + (snap.codAmount || 0),
        supplierEarnings: acc.supplierEarnings + (snap.supplierEarnings || 0),
        resellerEarnings: acc.resellerEarnings + (snap.resellerEarnings || 0),
        platformEarnings: acc.platformEarnings + (snap.platformEarnings || 0),
        stripeRevenue: acc.stripeRevenue + (snap.stripeRevenue || 0),
        paypalRevenue: acc.paypalRevenue + (snap.paypalRevenue || 0),
        codRevenue: acc.codRevenue + (snap.codRevenue || 0),
      }),
      {
        ordersCount: 0,
        grossRevenue: 0,
        netRevenue: 0,
        taxCollected: 0,
        shippingCollected: 0,
        discounts: 0,
        refunds: 0,
        codAmount: 0,
        supplierEarnings: 0,
        resellerEarnings: 0,
        platformEarnings: 0,
        stripeRevenue: 0,
        paypalRevenue: 0,
        codRevenue: 0,
      }
    );

    // Get comparison period (previous period of same length)
    const startDateObj = new Date(start + 'T00:00:00.000Z');
    const endDateObj = new Date(end + 'T00:00:00.000Z');
    const periodLength = endDateObj.getTime() - startDateObj.getTime();
    const prevStartDateObj = new Date(startDateObj.getTime() - periodLength);
    const prevEndDateObj = new Date(startDateObj);

    const prevStart = formatDate(prevStartDateObj);
    const prevEnd = formatDate(prevEndDateObj);

    const prevQuery: any = {
      storeId,
      scope,
      date: { $gte: prevStart, $lt: prevEnd },
    };

    if (entityId !== null) {
      prevQuery.entityId = entityId;
    } else {
      prevQuery.entityId = null;
    }

    const prevSnapshots = await SalesAnalyticsSnapshot.find(prevQuery)
      .sort({ date: 1 })
      .lean();

    const prevTotals = prevSnapshots.reduce(
      (acc, snap) => ({
        ordersCount: acc.ordersCount + (snap.ordersCount || 0),
        grossRevenue: acc.grossRevenue + (snap.grossRevenue || 0),
        netRevenue: acc.netRevenue + (snap.netRevenue || 0),
        refunds: acc.refunds + (snap.refunds || 0),
        supplierEarnings: acc.supplierEarnings + (snap.supplierEarnings || 0),
        resellerEarnings: acc.resellerEarnings + (snap.resellerEarnings || 0),
        platformEarnings: acc.platformEarnings + (snap.platformEarnings || 0),
      }),
      {
        ordersCount: 0,
        grossRevenue: 0,
        netRevenue: 0,
        refunds: 0,
        supplierEarnings: 0,
        resellerEarnings: 0,
        platformEarnings: 0,
      }
    );

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Audit log
    await logAudit({
      req,
      action: 'ANALYTICS_VIEWED',
      entityType: 'SalesAnalytics',
      description: `Analytics summary viewed for ${scope} scope`,
      metadata: {
        scope,
        entityId: entityId?.toString(),
        startDate: start,
        endDate: end,
      },
    });

    sendSuccess(res, {
      summary: totals,
      comparison: {
        ordersCount: {
          current: totals.ordersCount,
          previous: prevTotals.ordersCount,
          change: calculateChange(totals.ordersCount, prevTotals.ordersCount),
        },
        grossRevenue: {
          current: totals.grossRevenue,
          previous: prevTotals.grossRevenue,
          change: calculateChange(totals.grossRevenue, prevTotals.grossRevenue),
        },
        netRevenue: {
          current: totals.netRevenue,
          previous: prevTotals.netRevenue,
          change: calculateChange(totals.netRevenue, prevTotals.netRevenue),
        },
        refunds: {
          current: totals.refunds,
          previous: prevTotals.refunds,
          change: calculateChange(totals.refunds, prevTotals.refunds),
        },
        earnings: {
          current: scope === 'supplier' ? totals.supplierEarnings : scope === 'reseller' ? totals.resellerEarnings : totals.platformEarnings,
          previous: scope === 'supplier' ? prevTotals.supplierEarnings : scope === 'reseller' ? prevTotals.resellerEarnings : prevTotals.platformEarnings,
          change: calculateChange(
            scope === 'supplier' ? totals.supplierEarnings : scope === 'reseller' ? totals.resellerEarnings : totals.platformEarnings,
            scope === 'supplier' ? prevTotals.supplierEarnings : scope === 'reseller' ? prevTotals.resellerEarnings : prevTotals.platformEarnings
          ),
        },
      },
      dateRange: {
        start,
        end,
        previousStart: prevStart,
        previousEnd: prevEnd,
      },
    }, 'Analytics summary retrieved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/timeseries
 * Get time series data for a metric
 */
export const getTimeseries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    // Get scope and entity
    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    // Parse and validate query params
    const { metric, interval, startDate, endDate } = req.query;

    try {
      timeseriesSchema.parse({ metric, interval, startDate, endDate });
    } catch (error: any) {
      sendError(res, 'Invalid query parameters', 400);
      return;
    }

    const metricName = metric as string;
    const intervalType = (interval as string) || 'day';
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || thirtyDaysAgo;
    const end = (endDate as string) || today;

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
    const snapshots = await SalesAnalyticsSnapshot.find(query)
      .sort({ date: 1 })
      .lean();

    // Group by interval
    const grouped: Record<string, number> = {};

    for (const snap of snapshots) {
      let key: string;
      if (intervalType === 'day') {
        key = snap.date;
      } else if (intervalType === 'week') {
        // Get week start (Monday)
        const date = new Date(snap.date + 'T00:00:00.000Z');
        const dayOfWeek = date.getUTCDay();
        const diff = date.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(date);
        weekStart.setUTCDate(diff);
        key = formatDate(weekStart);
      } else {
        // Month
        const date = new Date(snap.date + 'T00:00:00.000Z');
        date.setUTCDate(1);
        key = formatDate(date);
      }

      if (!grouped[key]) {
        grouped[key] = 0;
      }

      grouped[key] += (snap as any)[metricName] || 0;
    }

    // Convert to array format
    const data = Object.entries(grouped)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Audit log
    await logAudit({
      req,
      action: 'ANALYTICS_VIEWED',
      entityType: 'SalesAnalytics',
      description: `Analytics timeseries viewed: ${metricName}`,
      metadata: {
        scope,
        entityId: entityId?.toString(),
        metric: metricName,
        interval: intervalType,
        startDate: start,
        endDate: end,
      },
    });

    sendSuccess(res, {
      metric: metricName,
      interval: intervalType,
      data,
      dateRange: { start, end },
    }, 'Timeseries data retrieved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/top-products
 * Get top products by revenue/quantity
 */
export const getTopProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const { limit = '10', startDate, endDate } = req.query;
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || thirtyDaysAgo;
    const end = (endDate as string) || today;

    // Build order query
    const orderQuery: any = {
      storeId,
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: {
        $gte: new Date(start + 'T00:00:00.000Z'),
        $lte: new Date(end + 'T23:59:59.999Z'),
      },
    };

    // Apply scope filters
    if (scope === 'supplier' && entityId) {
      const supplierId = typeof entityId === 'string' ? new mongoose.Types.ObjectId(entityId) : entityId;
      orderQuery.$or = [
        { supplierId: supplierId },
        { 'fulfillmentSnapshot.items.supplierId': supplierId },
      ];
    } else if (scope === 'reseller' && entityId) {
      orderQuery.resellerId = entityId.toString();
    }

    // Get orders
    const orders = await Order.find(orderQuery)
      .select('items')
      .lean();

    // Aggregate product metrics
    const productMap: Record<string, { sku: string; name: string; revenue: number; quantity: number }> = {};

    for (const order of orders) {
      for (const item of order.items || []) {
        const key = item.globalVariantId?.toString() || item.sku;
        if (!productMap[key]) {
          productMap[key] = {
            sku: item.sku,
            name: item.name,
            revenue: 0,
            quantity: 0,
          };
        }
        productMap[key].revenue += item.totalPrice || 0;
        productMap[key].quantity += item.quantity || 0;
      }
    }

    // Convert to array and sort
    const products = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, parseInt(limit as string, 10));

    // Audit log
    await logAudit({
      req,
      action: 'ANALYTICS_VIEWED',
      entityType: 'SalesAnalytics',
      description: 'Top products viewed',
      metadata: {
        scope,
        limit,
        startDate: start,
        endDate: end,
      },
    });

    sendSuccess(res, {
      products,
      dateRange: { start, end },
    }, 'Top products retrieved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/export
 * Export analytics data as CSV
 */
export const exportAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const { startDate, endDate, format = 'csv' } = req.query;
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || thirtyDaysAgo;
    const end = (endDate as string) || today;

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
    const snapshots = await SalesAnalyticsSnapshot.find(query)
      .sort({ date: 1 })
      .lean();

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date',
        'Orders',
        'Gross Revenue',
        'Net Revenue',
        'Tax Collected',
        'Shipping Collected',
        'Discounts',
        'Refunds',
        'COD Amount',
        scope === 'supplier' ? 'Supplier Earnings' : scope === 'reseller' ? 'Reseller Earnings' : 'Platform Earnings',
        'Stripe Revenue',
        'PayPal Revenue',
        'COD Revenue',
      ];

      const rows = snapshots.map((snap) => [
        snap.date,
        snap.ordersCount,
        snap.grossRevenue,
        snap.netRevenue,
        snap.taxCollected,
        snap.shippingCollected,
        snap.discounts,
        snap.refunds,
        snap.codAmount,
        scope === 'supplier' ? snap.supplierEarnings : scope === 'reseller' ? snap.resellerEarnings : snap.platformEarnings,
        snap.stripeRevenue,
        snap.paypalRevenue,
        snap.codRevenue,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${start}-${end}.csv"`);

      // Audit log
      await logAudit({
        req,
        action: 'ANALYTICS_EXPORTED',
        entityType: 'SalesAnalytics',
        description: `Analytics data exported as CSV`,
        metadata: {
          scope,
          entityId: entityId?.toString(),
          startDate: start,
          endDate: end,
          format: 'csv',
        },
      });

      res.send(csv);
    } else {
      sendError(res, 'Unsupported export format. Use csv', 400);
    }
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/returns
 * Get returns and refunds analytics
 */
export const getReturns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || thirtyDaysAgo;
    const end = (endDate as string) || today;

    const startDateObj = new Date(start + 'T00:00:00.000Z');
    const endDateObj = new Date(end + 'T23:59:59.999Z');

    // Build RMA query
    const rmaQuery: any = {
      storeId,
      status: { $in: ['received', 'refunded', 'closed'] },
      createdAt: { $gte: startDateObj, $lte: endDateObj },
    };

    // Get RMAs
    const rmas = await RMA.find(rmaQuery).lean();

    // Get credit notes for refunds
    const orderIds = rmas.filter((r) => r.orderId).map((r) => r.orderId!.toString());
    const creditNotes = await CreditNote.find({
      storeId,
      orderId: { $in: orderIds },
      status: 'issued',
    }).lean();

    // Calculate metrics
    const totalReturns = rmas.length;
    const totalRefundValue = creditNotes.reduce((sum, cn) => sum + Math.abs(cn.totalAmount || 0), 0);

    // Get orders for return rate calculation
    const orderQuery: any = {
      storeId,
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: { $gte: startDateObj, $lte: endDateObj },
    };

    if (scope === 'supplier' && entityId) {
      const supplierId = typeof entityId === 'string' ? new mongoose.Types.ObjectId(entityId) : entityId;
      orderQuery.$or = [
        { supplierId: supplierId },
        { 'fulfillmentSnapshot.items.supplierId': supplierId },
      ];
    } else if (scope === 'reseller' && entityId) {
      orderQuery.resellerId = entityId.toString();
    }

    const totalOrders = await Order.countDocuments(orderQuery);
    const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

    // Return reasons distribution
    const reasonCounts: Record<string, number> = {};
    for (const rma of rmas) {
      for (const item of rma.items || []) {
        const reason = item.reason || 'unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }

    // Most returned SKUs
    const skuReturns: Record<string, number> = {};
    for (const rma of rmas) {
      for (const item of rma.items || []) {
        const sku = item.globalVariantId?.toString() || 'unknown';
        skuReturns[sku] = (skuReturns[sku] || 0) + (item.quantity || 0);
      }
    }

    const topReturnedSkus = Object.entries(skuReturns)
      .map(([sku, count]) => ({ sku, returnCount: count }))
      .sort((a, b) => b.returnCount - a.returnCount)
      .slice(0, 10);

    // Audit log
    await logAudit({
      req,
      action: 'ANALYTICS_VIEWED',
      entityType: 'SalesAnalytics',
      description: 'Returns analytics viewed',
      metadata: {
        scope,
        startDate: start,
        endDate: end,
      },
    });

    sendSuccess(res, {
      summary: {
        totalReturns,
        totalRefundValue,
        returnRate: parseFloat(returnRate.toFixed(2)),
        totalOrders,
      },
      returnReasons: Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count })),
      topReturnedSkus,
      dateRange: { start, end },
    }, 'Returns analytics retrieved successfully');
  } catch (error: any) {
    next(error);
  }
};

