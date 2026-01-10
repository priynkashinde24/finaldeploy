import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import {
  getMetricSum,
  getMetricCount,
  aggregateDaily,
} from '../services/metricsService';

/**
 * Get analytics summary for a store
 * GET /api/analytics/:storeId/summary
 */
export const getAnalyticsSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { storeId } = req.params;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get today's metrics
    const totalSalesToday = await getMetricSum(storeId, 'orders.revenue', todayStart, todayEnd);
    const ordersCountToday = await getMetricCount(storeId, 'orders.count', todayStart, todayEnd);

    // Calculate AOV (Average Order Value)
    let aov = 0;
    if (ordersCountToday > 0) {
      aov = totalSalesToday / ordersCountToday;
      aov = Math.round(aov * 100) / 100;
    }

    // Calculate conversion rate (approximate)
    // Conversion = (orders paid) / (checkouts started)
    const checkoutsStarted = await getMetricCount(storeId, 'checkouts.started', todayStart, todayEnd);
    const ordersPaid = await getMetricCount(storeId, 'orders.count', todayStart, todayEnd);
    let conversionRate = 0;
    if (checkoutsStarted > 0) {
      conversionRate = (ordersPaid / checkoutsStarted) * 100;
      conversionRate = Math.round(conversionRate * 100) / 100;
    }

    sendSuccess(
      res,
      {
        storeId,
        totalSalesToday,
        ordersCountToday,
        aov,
        conversionRate,
        period: {
          from: todayStart.toISOString(),
          to: todayEnd.toISOString(),
        },
      },
      'Analytics summary retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get timeseries data for a metric
 * GET /api/analytics/:storeId/timeseries?metric=orders&from=&to=
 */
export const getTimeseries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { metric, from, to } = req.query;

    if (!metric || typeof metric !== 'string') {
      sendError(res, 'Metric parameter is required', 400);
      return;
    }

    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
    const toDate = to ? new Date(to as string) : new Date();

    // Get daily aggregated data
    const dailyData = await aggregateDaily(storeId, metric as string, fromDate, toDate);

    // Format for frontend
    const points = dailyData.map((point) => ({
      timestamp: point.day.toISOString(),
      value: point.value,
    }));

    sendSuccess(
      res,
      {
        storeId,
        metric,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        points,
      },
      'Timeseries data retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

