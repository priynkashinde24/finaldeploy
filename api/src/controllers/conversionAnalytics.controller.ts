import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { ConversionSnapshot } from '../models/ConversionSnapshot';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Conversion Analytics Controller
 * 
 * PURPOSE:
 * - Provide conversion funnel insights
 * - Support Admin and Reseller views
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
  scope: 'admin' | 'reseller';
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
    // Reseller ID is typically the user ID or store owner ID
    const resellerId = user.id?.toString() || storeId?.toString() || '';
    return { scope: 'reseller', entityId: resellerId };
  }

  throw new Error('Invalid user role for conversion analytics');
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
 * GET /analytics/conversion/summary
 * Get conversion summary KPIs
 */
export const getConversionSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const snapshots = await ConversionSnapshot.find(query)
      .sort({ date: 1 })
      .lean();

    // Aggregate totals
    const totals = snapshots.reduce(
      (acc, snap) => ({
        pageViews: acc.pageViews + (snap.pageViews || 0),
        productViews: acc.productViews + (snap.productViews || 0),
        addToCart: acc.addToCart + (snap.addToCart || 0),
        cartView: acc.cartView + (snap.cartView || 0),
        checkoutStarted: acc.checkoutStarted + (snap.checkoutStarted || 0),
        paymentInitiated: acc.paymentInitiated + (snap.paymentInitiated || 0),
        ordersConfirmed: acc.ordersConfirmed + (snap.ordersConfirmed || 0),
        cartAbandoned: acc.cartAbandoned + (snap.cartAbandoned || 0),
        checkoutAbandoned: acc.checkoutAbandoned + (snap.checkoutAbandoned || 0),
        recoveryConverted: acc.recoveryConverted + (snap.recoveryConverted || 0),
        stripeInitiated: acc.stripeInitiated + (snap.stripeInitiated || 0),
        paypalInitiated: acc.paypalInitiated + (snap.paypalInitiated || 0),
        codInitiated: acc.codInitiated + (snap.codInitiated || 0),
        stripeSuccess: acc.stripeSuccess + (snap.stripeSuccess || 0),
        paypalSuccess: acc.paypalSuccess + (snap.paypalSuccess || 0),
        codSuccess: acc.codSuccess + (snap.codSuccess || 0),
        paymentFailures: acc.paymentFailures + (snap.paymentFailures || 0),
      }),
      {
        pageViews: 0,
        productViews: 0,
        addToCart: 0,
        cartView: 0,
        checkoutStarted: 0,
        paymentInitiated: 0,
        ordersConfirmed: 0,
        cartAbandoned: 0,
        checkoutAbandoned: 0,
        recoveryConverted: 0,
        stripeInitiated: 0,
        paypalInitiated: 0,
        codInitiated: 0,
        stripeSuccess: 0,
        paypalSuccess: 0,
        codSuccess: 0,
        paymentFailures: 0,
      }
    );

    // Calculate rates
    const addToCartRate = totals.productViews > 0 ? (totals.addToCart / totals.productViews) * 100 : 0;
    const checkoutConversionRate = totals.addToCart > 0 ? (totals.checkoutStarted / totals.addToCart) * 100 : 0;
    const paymentSuccessRate = totals.checkoutStarted > 0 ? (totals.paymentInitiated / totals.checkoutStarted) * 100 : 0;
    const overallConversionRate = totals.pageViews > 0 ? (totals.ordersConfirmed / totals.pageViews) * 100 : 0;
    const cartAbandonmentRate = totals.addToCart > 0 ? (totals.cartAbandoned / totals.addToCart) * 100 : 0;
    const checkoutAbandonmentRate = totals.checkoutStarted > 0 ? (totals.checkoutAbandoned / totals.checkoutStarted) * 100 : 0;

    // Get comparison period
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

    const prevSnapshots = await ConversionSnapshot.find(prevQuery)
      .sort({ date: 1 })
      .lean();

    const prevTotals = prevSnapshots.reduce(
      (acc, snap) => ({
        pageViews: acc.pageViews + (snap.pageViews || 0),
        productViews: acc.productViews + (snap.productViews || 0),
        addToCart: acc.addToCart + (snap.addToCart || 0),
        checkoutStarted: acc.checkoutStarted + (snap.checkoutStarted || 0),
        ordersConfirmed: acc.ordersConfirmed + (snap.ordersConfirmed || 0),
        overallConversionRate: snap.overallConversionRate || 0,
      }),
      {
        pageViews: 0,
        productViews: 0,
        addToCart: 0,
        checkoutStarted: 0,
        ordersConfirmed: 0,
        overallConversionRate: 0,
      }
    );

    const prevOverallConversionRate = prevTotals.pageViews > 0 ? (prevTotals.ordersConfirmed / prevTotals.pageViews) * 100 : 0;

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Audit log
    await logAudit({
      req,
      action: 'CONVERSION_ANALYTICS_VIEWED',
      entityType: 'ConversionAnalytics',
      description: `Conversion summary viewed for ${scope} scope`,
      metadata: {
        scope,
        entityId: entityId?.toString(),
        startDate: start,
        endDate: end,
      },
    });

    sendSuccess(res, {
      summary: {
        ...totals,
        addToCartRate: parseFloat(addToCartRate.toFixed(2)),
        checkoutConversionRate: parseFloat(checkoutConversionRate.toFixed(2)),
        paymentSuccessRate: parseFloat(paymentSuccessRate.toFixed(2)),
        overallConversionRate: parseFloat(overallConversionRate.toFixed(2)),
        cartAbandonmentRate: parseFloat(cartAbandonmentRate.toFixed(2)),
        checkoutAbandonmentRate: parseFloat(checkoutAbandonmentRate.toFixed(2)),
      },
      comparison: {
        overallConversionRate: {
          current: parseFloat(overallConversionRate.toFixed(2)),
          previous: parseFloat(prevOverallConversionRate.toFixed(2)),
          change: calculateChange(overallConversionRate, prevOverallConversionRate),
        },
        ordersConfirmed: {
          current: totals.ordersConfirmed,
          previous: prevTotals.ordersConfirmed,
          change: calculateChange(totals.ordersConfirmed, prevTotals.ordersConfirmed),
        },
      },
      dateRange: {
        start,
        end,
        previousStart: prevStart,
        previousEnd: prevEnd,
      },
    }, 'Conversion summary retrieved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/conversion/funnel
 * Get funnel visualization data
 */
export const getFunnel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const snapshots = await ConversionSnapshot.find(query)
      .sort({ date: 1 })
      .lean();

    // Aggregate totals
    const totals = snapshots.reduce(
      (acc, snap) => ({
        pageViews: acc.pageViews + (snap.pageViews || 0),
        productViews: acc.productViews + (snap.productViews || 0),
        addToCart: acc.addToCart + (snap.addToCart || 0),
        checkoutStarted: acc.checkoutStarted + (snap.checkoutStarted || 0),
        paymentInitiated: acc.paymentInitiated + (snap.paymentInitiated || 0),
        ordersConfirmed: acc.ordersConfirmed + (snap.ordersConfirmed || 0),
      }),
      {
        pageViews: 0,
        productViews: 0,
        addToCart: 0,
        checkoutStarted: 0,
        paymentInitiated: 0,
        ordersConfirmed: 0,
      }
    );

    // Build funnel steps with drop-off calculations
    const funnel = [
      {
        step: 'Page View',
        count: totals.pageViews,
        dropOff: 0,
        conversionRate: 100,
      },
      {
        step: 'Product View',
        count: totals.productViews,
        dropOff: totals.pageViews - totals.productViews,
        dropOffPercent: totals.pageViews > 0 ? ((totals.pageViews - totals.productViews) / totals.pageViews) * 100 : 0,
        conversionRate: totals.pageViews > 0 ? (totals.productViews / totals.pageViews) * 100 : 0,
      },
      {
        step: 'Add to Cart',
        count: totals.addToCart,
        dropOff: totals.productViews - totals.addToCart,
        dropOffPercent: totals.productViews > 0 ? ((totals.productViews - totals.addToCart) / totals.productViews) * 100 : 0,
        conversionRate: totals.productViews > 0 ? (totals.addToCart / totals.productViews) * 100 : 0,
      },
      {
        step: 'Checkout Started',
        count: totals.checkoutStarted,
        dropOff: totals.addToCart - totals.checkoutStarted,
        dropOffPercent: totals.addToCart > 0 ? ((totals.addToCart - totals.checkoutStarted) / totals.addToCart) * 100 : 0,
        conversionRate: totals.addToCart > 0 ? (totals.checkoutStarted / totals.addToCart) * 100 : 0,
      },
      {
        step: 'Payment Initiated',
        count: totals.paymentInitiated,
        dropOff: totals.checkoutStarted - totals.paymentInitiated,
        dropOffPercent: totals.checkoutStarted > 0 ? ((totals.checkoutStarted - totals.paymentInitiated) / totals.checkoutStarted) * 100 : 0,
        conversionRate: totals.checkoutStarted > 0 ? (totals.paymentInitiated / totals.checkoutStarted) * 100 : 0,
      },
      {
        step: 'Order Confirmed',
        count: totals.ordersConfirmed,
        dropOff: totals.paymentInitiated - totals.ordersConfirmed,
        dropOffPercent: totals.paymentInitiated > 0 ? ((totals.paymentInitiated - totals.ordersConfirmed) / totals.paymentInitiated) * 100 : 0,
        conversionRate: totals.paymentInitiated > 0 ? (totals.ordersConfirmed / totals.paymentInitiated) * 100 : 0,
      },
    ];

    // Audit log
    await logAudit({
      req,
      action: 'CONVERSION_ANALYTICS_VIEWED',
      entityType: 'ConversionAnalytics',
      description: `Funnel data viewed for ${scope} scope`,
      metadata: {
        scope,
        entityId: entityId?.toString(),
        startDate: start,
        endDate: end,
      },
    });

    sendSuccess(res, {
      funnel,
      dateRange: { start, end },
    }, 'Funnel data retrieved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/conversion/timeseries
 * Get conversion metrics over time
 */
export const getConversionTimeseries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const { metric, interval = 'day', startDate, endDate } = req.query;
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || thirtyDaysAgo;
    const end = (endDate as string) || today;

    const metricName = (metric as string) || 'overallConversionRate';
    const intervalType = (interval as string) || 'day';

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
    const snapshots = await ConversionSnapshot.find(query)
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

      // Get metric value
      let value = 0;
      if (metricName === 'overallConversionRate') {
        value = snap.overallConversionRate || 0;
      } else if (metricName === 'addToCartRate') {
        value = snap.addToCartRate || 0;
      } else if (metricName === 'checkoutConversionRate') {
        value = snap.checkoutConversionRate || 0;
      } else if (metricName === 'paymentSuccessRate') {
        value = snap.paymentSuccessRate || 0;
      } else {
        value = (snap as any)[metricName] || 0;
      }

      grouped[key] += value;
    }

    // Convert to array format
    const data = Object.entries(grouped)
      .map(([date, value]) => ({ date, value: intervalType === 'day' ? value : value / Object.keys(grouped).length }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Audit log
    await logAudit({
      req,
      action: 'CONVERSION_ANALYTICS_VIEWED',
      entityType: 'ConversionAnalytics',
      description: `Conversion timeseries viewed: ${metricName}`,
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
    }, 'Conversion timeseries retrieved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/conversion/export
 * Export conversion data as CSV
 */
export const exportConversionAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const snapshots = await ConversionSnapshot.find(query)
      .sort({ date: 1 })
      .lean();

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date',
        'Page Views',
        'Product Views',
        'Add to Cart',
        'Checkout Started',
        'Payment Initiated',
        'Orders Confirmed',
        'Add to Cart Rate (%)',
        'Checkout Conversion Rate (%)',
        'Payment Success Rate (%)',
        'Overall Conversion Rate (%)',
        'Cart Abandoned',
        'Checkout Abandoned',
        'Recovery Converted',
        'Stripe Initiated',
        'PayPal Initiated',
        'COD Initiated',
        'Stripe Success',
        'PayPal Success',
        'COD Success',
        'Payment Failures',
      ];

      const rows = snapshots.map((snap) => [
        snap.date,
        snap.pageViews,
        snap.productViews,
        snap.addToCart,
        snap.checkoutStarted,
        snap.paymentInitiated,
        snap.ordersConfirmed,
        snap.addToCartRate.toFixed(2),
        snap.checkoutConversionRate.toFixed(2),
        snap.paymentSuccessRate.toFixed(2),
        snap.overallConversionRate.toFixed(2),
        snap.cartAbandoned,
        snap.checkoutAbandoned,
        snap.recoveryConverted,
        snap.stripeInitiated,
        snap.paypalInitiated,
        snap.codInitiated,
        snap.stripeSuccess,
        snap.paypalSuccess,
        snap.codSuccess,
        snap.paymentFailures,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="conversion-analytics-${start}-${end}.csv"`);

      // Audit log
      await logAudit({
        req,
        action: 'CONVERSION_ANALYTICS_EXPORTED',
        entityType: 'ConversionAnalytics',
        description: `Conversion analytics data exported as CSV`,
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

