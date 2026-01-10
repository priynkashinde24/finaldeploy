import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { AOVSnapshot } from '../models/AOVSnapshot';
import { Order } from '../models/Order';

/**
 * AOV Reports (Admin)
 *
 * AOV definition:
 *   AOV = Total Revenue / Total Completed Orders
 *
 * Completed orders:
 *   orderStatus in ['confirmed', 'delivered']
 *
 * Strategy:
 * - Use AOVSnapshot for overview + trend (fast, pre-aggregated from completed orders)
 * - Use aggregation pipelines over Orders for breakdowns and high-value order table
 * - Provide date range filtering on all endpoints
 */

const COMPLETED_ORDER_STATUSES = ['confirmed', 'delivered'] as const;

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const trendSchema = dateRangeSchema.extend({
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

const hvOrdersSchema = dateRangeSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  minTotal: z.coerce.number().min(0).default(0),
});

type CacheEntry = { expiresAt: number; value: any };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function getCache<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCache(key: string, value: any, ttlMs: number = TTL_MS) {
  CACHE.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function assertAdmin(req: Request, res: Response): boolean {
  const role = (req as any).user?.role;
  if (role !== 'admin') {
    sendError(res, 'Admin access required', 403);
    return false;
  }
  return true;
}

function getStoreId(req: Request, res: Response): mongoose.Types.ObjectId | null {
  const storeIdStr = (req as any).store?.storeId as string | undefined;
  if (!storeIdStr) {
    sendError(res, 'Store context required', 400);
    return null;
  }
  return new mongoose.Types.ObjectId(storeIdStr);
}

function getDateRange(req: Request): { start: string; end: string } {
  const today = formatDate(new Date());
  const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const start = (req.query.startDate as string) || thirtyDaysAgo;
  const end = (req.query.endDate as string) || today;
  dateRangeSchema.parse({ startDate: start, endDate: end });
  return { start, end };
}

/**
 * GET /analytics/aov/overview
 */
export const getAOVOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeId = getStoreId(req, res);
    if (!storeId) return;

    const { start, end } = getDateRange(req);
    const cacheKey = `aov:overview:${storeId.toString()}:${start}:${end}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    const currentAgg = await AOVSnapshot.aggregate([
      { $match: { storeId, scope: 'admin', entityId: null, date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: { $ifNull: ['$ordersCount', 0] } },
          totalRevenue: { $sum: { $ifNull: ['$grossRevenue', 0] } },
        },
      },
    ]);

    const current = currentAgg?.[0] || { totalOrders: 0, totalRevenue: 0 };
    const aov = current.totalOrders > 0 ? current.totalRevenue / current.totalOrders : 0;

    // Previous period of same length
    const startDateObj = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T00:00:00.000Z`);
    const periodMs = endDateObj.getTime() - startDateObj.getTime();
    const prevStart = formatDate(new Date(startDateObj.getTime() - periodMs));
    const prevEnd = formatDate(new Date(startDateObj.getTime()));

    const prevAgg = await AOVSnapshot.aggregate([
      { $match: { storeId, scope: 'admin', entityId: null, date: { $gte: prevStart, $lt: prevEnd } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: { $ifNull: ['$ordersCount', 0] } },
          totalRevenue: { $sum: { $ifNull: ['$grossRevenue', 0] } },
        },
      },
    ]);
    const prev = prevAgg?.[0] || { totalOrders: 0, totalRevenue: 0 };
    const prevAov = prev.totalOrders > 0 ? prev.totalRevenue / prev.totalOrders : 0;

    const growthPercent =
      prevAov === 0 ? (aov > 0 ? 100 : 0) : ((aov - prevAov) / prevAov) * 100;

    const payload = {
      aov,
      totalRevenue: current.totalRevenue,
      totalCompletedOrders: current.totalOrders,
      growthPercent,
      dateRange: { start, end, previousStart: prevStart, previousEnd: prevEnd },
    };

    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/aov/trend?interval=daily|weekly|monthly
 */
export const getAOVTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeId = getStoreId(req, res);
    if (!storeId) return;

    const parsed = trendSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      interval: req.query.interval,
    });

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const cacheKey = `aov:trend:${storeId.toString()}:${start}:${end}:${parsed.interval}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    const unit = parsed.interval === 'daily' ? 'day' : parsed.interval === 'weekly' ? 'week' : 'month';

    const rows = await AOVSnapshot.aggregate([
      { $match: { storeId, scope: 'admin', entityId: null, date: { $gte: start, $lte: end } } },
      {
        $addFields: {
          dateObj: { $dateFromString: { dateString: '$date', format: '%Y-%m-%d', timezone: 'UTC' } },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: '$dateObj', unit, binSize: 1, timezone: 'UTC' } },
          revenue: { $sum: { $ifNull: ['$grossRevenue', 0] } },
          orders: { $sum: { $ifNull: ['$ordersCount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { date: '$_id', format: '%Y-%m-%d', timezone: 'UTC' } },
          revenue: 1,
          orders: 1,
          aov: { $cond: [{ $eq: ['$orders', 0] }, 0, { $divide: ['$revenue', '$orders'] }] },
        },
      },
    ]);

    const payload = {
      interval: parsed.interval,
      data: rows.map((r: any) => ({ ...r, aov: Math.round(Number(r.aov) * 100) / 100 })),
      dateRange: { start, end },
      definition: 'AOV = Total Revenue / Total Completed Orders',
    };

    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/aov/by-category
 *
 * AOV-by-category here is defined as:
 *   (Revenue from items in category) / (Distinct completed orders that included that category)
 */
export const getAOVByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeId = getStoreId(req, res);
    if (!storeId) return;
    const { start, end } = getDateRange(req);

    const cacheKey = `aov:byCategory:${storeId.toString()}:${start}:${end}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    const startDateObj = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T23:59:59.999Z`);

    const rows = await Order.aggregate([
      {
        $match: {
          storeId,
          orderStatus: { $in: [...COMPLETED_ORDER_STATUSES] },
          createdAt: { $gte: startDateObj, $lte: endDateObj },
        },
      },
      { $unwind: '$items' },
      {
        $project: {
          orderId: 1,
          productId: '$items.globalProductId',
          itemRevenue: { $ifNull: ['$items.totalPrice', 0] },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$category._id', null] },
          categoryName: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
          revenue: { $sum: '$itemRevenue' },
          orders: { $addToSet: '$orderId' },
        },
      },
      {
        $project: {
          _id: 0,
          categoryId: { $cond: [{ $eq: ['$_id', null] }, null, { $toString: '$_id' }] },
          categoryName: 1,
          revenue: 1,
          completedOrders: { $size: '$orders' },
          aov: { $cond: [{ $eq: [{ $size: '$orders' }, 0] }, 0, { $divide: ['$revenue', { $size: '$orders' }] }] },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 12 },
    ]);

    const payload = {
      rows: rows.map((r: any) => ({ ...r, aov: Math.round(Number(r.aov) * 100) / 100 })),
      dateRange: { start, end },
    };
    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/aov/by-channel
 *
 * Channel is derived from order.marketingAttribution.lastTouch.channel (fallback to firstTouch.channel, then 'direct').
 */
export const getAOVByChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeId = getStoreId(req, res);
    if (!storeId) return;
    const { start, end } = getDateRange(req);

    const cacheKey = `aov:byChannel:${storeId.toString()}:${start}:${end}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    const startDateObj = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T23:59:59.999Z`);

    const rows = await Order.aggregate([
      {
        $match: {
          storeId,
          orderStatus: { $in: [...COMPLETED_ORDER_STATUSES] },
          createdAt: { $gte: startDateObj, $lte: endDateObj },
        },
      },
      {
        $project: {
          orderId: 1,
          channel: {
            $ifNull: ['$marketingAttribution.lastTouch.channel', { $ifNull: ['$marketingAttribution.firstTouch.channel', 'direct'] }],
          },
          revenue: { $ifNull: ['$totalAmountWithTax', '$grandTotal'] },
        },
      },
      {
        $group: {
          _id: '$channel',
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          orders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          channel: { $ifNull: ['$_id', 'direct'] },
          revenue: 1,
          orders: 1,
          aov: { $cond: [{ $eq: ['$orders', 0] }, 0, { $divide: ['$revenue', '$orders'] }] },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 12 },
    ]);

    const payload = {
      rows: rows.map((r: any) => ({ ...r, aov: Math.round(Number(r.aov) * 100) / 100 })),
      dateRange: { start, end },
    };
    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/aov/high-value-orders
 */
export const getHighValueOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeId = getStoreId(req, res);
    if (!storeId) return;

    const parsed = hvOrdersSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit,
      minTotal: req.query.minTotal,
    });

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const startDateObj = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T23:59:59.999Z`);
    const skip = (parsed.page - 1) * parsed.limit;

    const totalExpr = { $ifNull: ['$totalAmountWithTax', '$grandTotal'] };

    const [result] = await Order.aggregate([
      {
        $match: {
          storeId,
          orderStatus: { $in: [...COMPLETED_ORDER_STATUSES] },
          createdAt: { $gte: startDateObj, $lte: endDateObj },
        },
      },
      {
        $addFields: {
          total: totalExpr,
        },
      },
      { $match: { total: { $gte: parsed.minTotal } } },
      { $sort: { total: -1, createdAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: parsed.limit },
            {
              $project: {
                _id: 0,
                orderId: 1,
                orderNumber: 1,
                customerName: 1,
                customerEmail: 1,
                orderStatus: 1,
                paymentStatus: 1,
                paymentMethod: 1,
                total: 1,
                createdAt: 1,
                channel: {
                  $ifNull: ['$marketingAttribution.lastTouch.channel', { $ifNull: ['$marketingAttribution.firstTouch.channel', 'direct'] }],
                },
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const items = result?.items || [];
    const total = result?.total?.[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsed.limit));

    sendSuccess(res, {
      items,
      page: parsed.page,
      limit: parsed.limit,
      total,
      totalPages,
      minTotal: parsed.minTotal,
      dateRange: { start, end },
    });
  } catch (error) {
    next(error);
  }
};


