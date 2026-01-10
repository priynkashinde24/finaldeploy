import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { AttributionSnapshot } from '../models/AttributionSnapshot';
import { MarketingCost } from '../models/MarketingCost';
import { Order } from '../models/Order';
import { MarketingTouch } from '../models/MarketingTouch';
import { AttributionSession } from '../models/AttributionSession';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Attribution Analytics Controller
 * 
 * Handles:
 * - Attribution summary
 * - Channel performance
 * - Model comparison
 * - ROI analysis
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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

function setCache(key: string, value: any, ttlMs: number = TTL_MS): void {
  CACHE.set(key, { expiresAt: Date.now() + ttlMs, value });
}

/**
 * GET /analytics/attribution/summary
 * Get attribution summary
 */
export const getAttributionSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { startDate, endDate, attributionModel = 'last_touch' } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    const dateRangeSchema = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });

    try {
      dateRangeSchema.parse({ startDate: start, endDate: end });
    } catch (error: any) {
      sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      return;
    }

    const cacheKey = `attr:summary:${storeId.toString()}:${start}:${end}:${attributionModel}`;
    const cached = getCache<any>(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const snapshots = await AttributionSnapshot.find({
      storeId,
      date: { $gte: start, $lte: end },
      attributionModel: attributionModel as string,
    }).lean();

    // Aggregate totals
    const summary = {
      totalVisits: 0,
      totalSignups: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalCost: 0,
      overallConversionRate: 0,
      overallAOV: 0,
      overallROI: 0,
      channels: [] as any[],
    };

    const channelMap = new Map<string, any>();

    for (const snapshot of snapshots) {
      summary.totalVisits += snapshot.visits || 0;
      summary.totalSignups += snapshot.signups || 0;
      summary.totalOrders += snapshot.orders || 0;
      summary.totalRevenue += snapshot.revenue || 0;
      summary.totalCost += snapshot.cost || 0;

      if (!channelMap.has(snapshot.channel)) {
        channelMap.set(snapshot.channel, {
          channel: snapshot.channel,
          visits: 0,
          signups: 0,
          orders: 0,
          revenue: 0,
          cost: 0,
        });
      }

      const channel = channelMap.get(snapshot.channel)!;
      channel.visits += snapshot.visits || 0;
      channel.signups += snapshot.signups || 0;
      channel.orders += snapshot.orders || 0;
      channel.revenue += snapshot.revenue || 0;
      channel.cost += snapshot.cost || 0;
    }

    summary.overallConversionRate = summary.totalVisits > 0 ? (summary.totalOrders / summary.totalVisits) * 100 : 0;
    summary.overallAOV = summary.totalOrders > 0 ? summary.totalRevenue / summary.totalOrders : 0;
    summary.overallROI = summary.totalCost > 0 ? ((summary.totalRevenue - summary.totalCost) / summary.totalCost) * 100 : 0;

    summary.channels = Array.from(channelMap.values()).map((ch) => ({
      ...ch,
      conversionRate: ch.visits > 0 ? (ch.orders / ch.visits) * 100 : 0,
      aov: ch.orders > 0 ? ch.revenue / ch.orders : 0,
      roi: ch.cost > 0 ? ((ch.revenue - ch.cost) / ch.cost) * 100 : 0,
    }));

    await logAudit({
      action: 'ATTRIBUTION_ANALYTICS_VIEWED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'AttributionAnalytics',
      entityId: storeId.toString(),
      description: `Viewed attribution summary (model: ${attributionModel})`,
      metadata: { attributionModel, dateRange: { start, end } },
    });

    const payload = { summary, dateRange: { start, end }, attributionModel };
    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/attribution/channels
 * Get channel performance
 */
export const getChannelPerformance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { startDate, endDate, attributionModel = 'last_touch', channel } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    const cacheKey = `attr:channels:${storeId.toString()}:${start}:${end}:${attributionModel}:${channel || 'all'}`;
    const cached = getCache<any>(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const query: any = {
      storeId,
      date: { $gte: start, $lte: end },
      attributionModel: attributionModel as string,
    };

    if (channel) {
      query.channel = channel;
    }

    const snapshots = await AttributionSnapshot.find(query).sort({ date: 1 }).lean();

    // Group by channel and date
    const channelData = new Map<string, any[]>();

    for (const snapshot of snapshots) {
      if (!channelData.has(snapshot.channel)) {
        channelData.set(snapshot.channel, []);
      }
      channelData.get(snapshot.channel)!.push({
        date: snapshot.date,
        visits: snapshot.visits,
        signups: snapshot.signups,
        orders: snapshot.orders,
        revenue: snapshot.revenue,
        conversionRate: snapshot.conversionRate,
        aov: snapshot.averageOrderValue,
        cost: snapshot.cost || 0,
        roi: snapshot.roi || 0,
      });
    }

    const channels = Array.from(channelData.entries()).map(([channel, data]) => ({
      channel,
      timeseries: data,
      totals: {
        visits: data.reduce((sum, d) => sum + d.visits, 0),
        signups: data.reduce((sum, d) => sum + d.signups, 0),
        orders: data.reduce((sum, d) => sum + d.orders, 0),
        revenue: data.reduce((sum, d) => sum + d.revenue, 0),
        cost: data.reduce((sum, d) => sum + d.cost, 0),
      },
    }));

    const payload = { channels, dateRange: { start, end }, attributionModel };
    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/attribution/compare
 * Compare attribution models
 */
export const compareAttributionModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { startDate, endDate } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    const cacheKey = `attr:compare:${storeId.toString()}:${start}:${end}`;
    const cached = getCache<any>(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const models: Array<'first_touch' | 'last_touch' | 'linear' | 'time_decay'> = [
      'first_touch',
      'last_touch',
      'linear',
      'time_decay',
    ];

    const comparison: any = {};

    for (const model of models) {
      const snapshots = await AttributionSnapshot.find({
        storeId,
        date: { $gte: start, $lte: end },
        attributionModel: model,
      }).lean();

      const totals = {
        visits: 0,
        signups: 0,
        orders: 0,
        revenue: 0,
        cost: 0,
      };

      for (const snapshot of snapshots) {
        totals.visits += snapshot.visits || 0;
        totals.signups += snapshot.signups || 0;
        totals.orders += snapshot.orders || 0;
        totals.revenue += snapshot.revenue || 0;
        totals.cost += snapshot.cost || 0;
      }

      comparison[model] = {
        ...totals,
        conversionRate: totals.visits > 0 ? (totals.orders / totals.visits) * 100 : 0,
        aov: totals.orders > 0 ? totals.revenue / totals.orders : 0,
        roi: totals.cost > 0 ? ((totals.revenue - totals.cost) / totals.cost) * 100 : 0,
      };
    }

    const payload = { comparison, dateRange: { start, end } };
    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/attribution/roi
 * Get ROI by channel
 */
export const getAttributionROI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { startDate, endDate, attributionModel = 'last_touch' } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    const cacheKey = `attr:roi:${storeId.toString()}:${start}:${end}:${attributionModel}`;
    const cached = getCache<any>(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const snapshots = await AttributionSnapshot.find({
      storeId,
      date: { $gte: start, $lte: end },
      attributionModel: attributionModel as string,
    }).lean();

    const roiByChannel: any[] = [];

    const channelMap = new Map<string, { revenue: number; cost: number }>();

    for (const snapshot of snapshots) {
      if (!channelMap.has(snapshot.channel)) {
        channelMap.set(snapshot.channel, { revenue: 0, cost: 0 });
      }

      const channel = channelMap.get(snapshot.channel)!;
      channel.revenue += snapshot.revenue || 0;
      channel.cost += snapshot.cost || 0;
    }

    for (const [channel, data] of channelMap.entries()) {
      const roi = data.cost > 0 ? ((data.revenue - data.cost) / data.cost) * 100 : null;
      roiByChannel.push({
        channel,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.revenue - data.cost,
        roi,
      });
    }

    roiByChannel.sort((a, b) => (b.roi || 0) - (a.roi || 0));

    const payload = { roi: roiByChannel, dateRange: { start, end }, attributionModel };
    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/attribution/paths
 * Returns top conversion paths (channel sequences) for completed orders.
 *
 * Query:
 * - startDate/endDate (YYYY-MM-DD)
 * - limit (default 20, max 100)
 * - attributionModel (controls which touch anchors the converting session; defaults last_touch)
 */
export const getAttributionPaths = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const querySchema = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      attributionModel: z.enum(['first_touch', 'last_touch', 'linear', 'time_decay']).default('last_touch'),
    });

    const parsed = querySchema.parse(req.query);
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || yesterday;
    const end = parsed.endDate || today;
    const limit = parsed.limit;
    const attributionModel = parsed.attributionModel;

    const cacheKey = `attr:paths:${storeId.toString()}:${start}:${end}:${attributionModel}:${limit}`;
    const cached = getCache<any>(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const startDt = new Date(`${start}T00:00:00.000Z`);
    const endDt = new Date(`${end}T23:59:59.999Z`);

    const touchField =
      attributionModel === 'first_touch'
        ? '$marketingAttribution.firstTouch.touchId'
        : '$marketingAttribution.lastTouch.touchId';

    const pipeline: any[] = [
      {
        $match: {
          storeId,
          createdAt: { $gte: startDt, $lte: endDt },
          orderStatus: { $in: ['confirmed', 'delivered'] },
          marketingAttribution: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          revenue: { $ifNull: ['$grandTotal', { $ifNull: ['$totalAmountWithTax', 0] }] },
          touchId: touchField,
        },
      },
      { $match: { touchId: { $ne: null } } },
      {
        $lookup: {
          from: 'marketingtouches',
          localField: 'touchId',
          foreignField: '_id',
          as: 'touch',
        },
      },
      { $unwind: '$touch' },
      {
        $lookup: {
          from: 'attributionsessions',
          localField: 'touch.sessionId',
          foreignField: 'sessionId',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      {
        $lookup: {
          from: 'marketingtouches',
          let: { ids: '$session.allTouchIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $sort: { occurredAt: 1 } },
            { $project: { channel: 1, occurredAt: 1 } },
          ],
          as: 'touches',
        },
      },
      {
        $addFields: {
          channels: {
            $map: {
              input: '$touches',
              as: 't',
              in: '$$t.channel',
            },
          },
        },
      },
      // De-dup consecutive channels (A,A,B,B,C => A,B,C)
      {
        $addFields: {
          pathChannels: {
            $reduce: {
              input: '$channels',
              initialValue: [],
              in: {
                $cond: [
                  { $eq: [{ $size: '$$value' }, 0] },
                  { $concatArrays: ['$$value', ['$$this']] },
                  {
                    $cond: [
                      { $eq: ['$$this', { $arrayElemAt: ['$$value', -1] }] },
                      '$$value',
                      { $concatArrays: ['$$value', ['$$this']] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          path: {
            $reduce: {
              input: '$pathChannels',
              initialValue: '',
              in: {
                $cond: [
                  { $eq: ['$$value', ''] },
                  '$$this',
                  { $concat: ['$$value', ' > ', '$$this'] },
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$path',
          orders: { $sum: 1 },
          revenue: { $sum: '$revenue' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          path: '$_id',
          orders: 1,
          revenue: 1,
        },
      },
    ];

    const paths = await Order.aggregate(pipeline).allowDiskUse(true);

    const payload = {
      paths,
      dateRange: { start, end },
      attributionModel,
    };
    setCache(cacheKey, payload);
    sendSuccess(res, payload);
  } catch (error: any) {
    next(error);
  }
};

