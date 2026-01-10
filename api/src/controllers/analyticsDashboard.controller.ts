import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { SalesAnalyticsSnapshot } from '../models/SalesAnalyticsSnapshot';
import { Order } from '../models/Order';

/**
 * Analytics Dashboard Controller
 *
 * Goals:
 * - Provide fast, admin-focused analytics endpoints for dashboards
 * - Use pre-aggregated snapshots where possible (SalesAnalyticsSnapshot)
 * - Use aggregation pipelines for breakdowns that aren't yet snapshotted
 * - Add lightweight in-memory TTL caching to avoid recalculating on every request
 *
 * NOTE ON PERFORMANCE:
 * - The ideal production setup is cron-based pre-aggregation into snapshot collections.
 * - These endpoints are structured so that you can later swap aggregation logic for snapshot reads.
 */

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const revenueRangeSchema = z.object({
  range: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orderStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

type CacheEntry = { expiresAt: number; value: any };
const CACHE = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000; // 60s

function getCache<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCache(key: string, value: any, ttlMs: number = DEFAULT_TTL_MS): void {
  CACHE.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateRange(req: Request): { start: string; end: string } {
  const today = formatDate(new Date());
  const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const start = (req.query.startDate as string) || thirtyDaysAgo;
  const end = (req.query.endDate as string) || today;
  dateRangeSchema.parse({ startDate: start, endDate: end });
  return { start, end };
}

function assertAdmin(req: Request, res: Response): boolean {
  const role = (req as any).user?.role;
  if (role !== 'admin') {
    sendError(res, 'Admin access required', 403);
    return false;
  }
  return true;
}

/**
 * GET /analytics/overview
 *
 * Returns:
 * - totalRevenue
 * - totalOrders
 * - averageOrderValue
 * - revenueGrowthPercent (current period vs previous period of same length)
 */
export const getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeIdStr = (req as any).store?.storeId as string | undefined;
    if (!storeIdStr) {
      sendError(res, 'Store context required', 400);
      return;
    }
    const storeId = new mongoose.Types.ObjectId(storeIdStr);

    const { start, end } = parseDateRange(req);
    const cacheKey = `overview:${storeId.toString()}:${start}:${end}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    // Aggregate current period from SalesAnalyticsSnapshot (admin scope)
    const current = await SalesAnalyticsSnapshot.aggregate([
      { $match: { storeId, scope: 'admin', entityId: null, date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$grossRevenue', 0] } },
          totalOrders: { $sum: { $ifNull: ['$ordersCount', 0] } },
        },
      },
    ]);

    const startDateObj = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T00:00:00.000Z`);
    const periodLengthMs = endDateObj.getTime() - startDateObj.getTime();
    const prevStart = formatDate(new Date(startDateObj.getTime() - periodLengthMs));
    const prevEnd = formatDate(new Date(startDateObj.getTime()));

    const previous = await SalesAnalyticsSnapshot.aggregate([
      { $match: { storeId, scope: 'admin', entityId: null, date: { $gte: prevStart, $lt: prevEnd } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$grossRevenue', 0] } },
          totalOrders: { $sum: { $ifNull: ['$ordersCount', 0] } },
        },
      },
    ]);

    const currentTotals = current?.[0] || { totalRevenue: 0, totalOrders: 0 };
    const prevTotals = previous?.[0] || { totalRevenue: 0, totalOrders: 0 };

    const averageOrderValue =
      currentTotals.totalOrders > 0 ? currentTotals.totalRevenue / currentTotals.totalOrders : 0;
    const revenueGrowthPercent =
      prevTotals.totalRevenue === 0
        ? currentTotals.totalRevenue > 0
          ? 100
          : 0
        : ((currentTotals.totalRevenue - prevTotals.totalRevenue) / prevTotals.totalRevenue) * 100;

    const payload = {
      totalRevenue: currentTotals.totalRevenue,
      totalOrders: currentTotals.totalOrders,
      averageOrderValue,
      revenueGrowthPercent,
      dateRange: { start, end, previousStart: prevStart, previousEnd: prevEnd },
    };

    setCache(cacheKey, payload, DEFAULT_TTL_MS);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/revenue?range=daily|weekly|monthly
 *
 * Revenue over time using SalesAnalyticsSnapshot (admin scope).
 */
export const getRevenue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeIdStr = (req as any).store?.storeId as string | undefined;
    if (!storeIdStr) {
      sendError(res, 'Store context required', 400);
      return;
    }
    const storeId = new mongoose.Types.ObjectId(storeIdStr);

    const parsed = revenueRangeSchema.parse({
      range: req.query.range,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const range = parsed.range;
    const cacheKey = `revenue:${storeId.toString()}:${start}:${end}:${range}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    const snapshots = await SalesAnalyticsSnapshot.find({
      storeId,
      scope: 'admin',
      entityId: null,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .select({ date: 1, grossRevenue: 1 })
      .lean();

    // Group by requested interval
    const grouped = new Map<string, number>();
    for (const snap of snapshots) {
      const d = new Date(`${snap.date}T00:00:00.000Z`);
      let key = snap.date;
      if (range === 'weekly') {
        // week start (Monday)
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        d.setUTCDate(diff);
        key = formatDate(d);
      } else if (range === 'monthly') {
        d.setUTCDate(1);
        key = formatDate(d);
      }
      grouped.set(key, (grouped.get(key) || 0) + (snap.grossRevenue || 0));
    }

    const data = Array.from(grouped.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const payload = { range, data, dateRange: { start, end } };
    setCache(cacheKey, payload, DEFAULT_TTL_MS);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/categories
 *
 * Sales by product category (bar chart).
 * Uses an aggregation pipeline over Orders and looks up Products → Categories.
 */
export const getCategorySales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeIdStr = (req as any).store?.storeId as string | undefined;
    if (!storeIdStr) {
      sendError(res, 'Store context required', 400);
      return;
    }
    const storeId = new mongoose.Types.ObjectId(storeIdStr);
    const { start, end } = parseDateRange(req);

    const cacheKey = `categories:${storeId.toString()}:${start}:${end}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    const startDateObj = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T23:59:59.999Z`);

    const results = await Order.aggregate([
      {
        $match: {
          storeId,
          createdAt: { $gte: startDateObj, $lte: endDateObj },
          orderStatus: { $in: ['confirmed', 'delivered'] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.globalProductId',
          revenue: { $sum: { $ifNull: ['$items.totalPrice', 0] } },
          quantity: { $sum: { $ifNull: ['$items.quantity', 0] } },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$product.categoryId',
          revenue: { $sum: '$revenue' },
          quantity: { $sum: '$quantity' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          categoryId: { $toString: '$_id' },
          categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
          revenue: 1,
          quantity: 1,
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 12 },
    ]);

    const payload = { categories: results, dateRange: { start, end } };
    setCache(cacheKey, payload, DEFAULT_TTL_MS);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/order-status
 *
 * Order status distribution (pie chart).
 */
export const getOrderStatusDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeIdStr = (req as any).store?.storeId as string | undefined;
    if (!storeIdStr) {
      sendError(res, 'Store context required', 400);
      return;
    }
    const storeId = new mongoose.Types.ObjectId(storeIdStr);
    const { start, end } = parseDateRange(req);

    const cacheKey = `orderStatus:${storeId.toString()}:${start}:${end}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return sendSuccess(res, cached);

    const startDateObj = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T23:59:59.999Z`);

    const statuses = await Order.aggregate([
      { $match: { storeId, createdAt: { $gte: startDateObj, $lte: endDateObj } } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]);

    const payload = { statuses, dateRange: { start, end } };
    setCache(cacheKey, payload, DEFAULT_TTL_MS);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/orders
 *
 * Recent orders with pagination + filters.
 */
export const getOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!assertAdmin(req, res)) return;
    const storeIdStr = (req as any).store?.storeId as string | undefined;
    if (!storeIdStr) {
      sendError(res, 'Store context required', 400);
      return;
    }
    const storeId = new mongoose.Types.ObjectId(storeIdStr);

    const parsed = ordersQuerySchema.parse({
      page: req.query.page,
      limit: req.query.limit,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      orderStatus: req.query.orderStatus,
      paymentStatus: req.query.paymentStatus,
      q: req.query.q,
    });

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const match: any = {
      storeId,
      createdAt: {
        $gte: new Date(`${start}T00:00:00.000Z`),
        $lte: new Date(`${end}T23:59:59.999Z`),
      },
    };
    if (parsed.orderStatus) match.orderStatus = parsed.orderStatus;
    if (parsed.paymentStatus) match.paymentStatus = parsed.paymentStatus;
    if (parsed.q) {
      const regex = new RegExp(parsed.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [{ orderNumber: regex }, { customerEmail: regex }, { customerName: regex }];
    }

    const skip = (parsed.page - 1) * parsed.limit;

    // Single roundtrip: results + total
    const [result] = await Order.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
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
                grandTotal: { $ifNull: ['$totalAmountWithTax', '$grandTotal'] },
                createdAt: 1,
                itemsCount: { $size: { $ifNull: ['$items', []] } },
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
      dateRange: { start, end },
    });
  } catch (error) {
    next(error);
  }
};


