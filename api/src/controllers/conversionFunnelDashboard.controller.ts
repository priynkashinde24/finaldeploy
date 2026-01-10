import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { FunnelEvent, FunnelEventType } from '../models/FunnelEvent';

/**
 * Conversion Funnel Dashboard (session-based)
 *
 * Requirements supported:
 * - session_id based funnel
 * - strict event order (timestamps per step)
 * - drop-off %
 * - date range filtering
 * - filters: device, source
 * - performance: aggregation pipelines + indexes (see FunnelEvent indexes)
 *
 * NOTE:
 * We treat PAYMENT_SUCCESS as either:
 * - explicit eventType PAYMENT_SUCCESS, OR
 * - legacy ORDER_CONFIRMED (fallback)
 */

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  device: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).optional(),
  source: z.string().trim().min(1).max(120).optional(),
});

const trendSchema = dateRangeSchema.extend({
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

const ingestSchema = z.object({
  sessionId: z.string().trim().min(4).max(200),
  eventType: z.enum(['PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED', 'PAYMENT_SUCCESS'] as const),
  entityId: z.string().trim().max(200).optional(),
  occurredAt: z.string().datetime().optional(),
  device: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).optional(),
  source: z.string().trim().min(1).max(120).optional(),
  pagePath: z.string().trim().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStoreObjectId(req: Request, res: Response): mongoose.Types.ObjectId | null {
  const storeIdStr = (req as any).store?.storeId as string | undefined;
  if (!storeIdStr) {
    sendError(res, 'Store context required', 400);
    return null;
  }
  return new mongoose.Types.ObjectId(storeIdStr);
}

function getEventTimeMatch(start: string, end: string) {
  return {
    $gte: new Date(`${start}T00:00:00.000Z`),
    $lte: new Date(`${end}T23:59:59.999Z`),
  };
}

/**
 * POST /analytics/conversion/event (public)
 * Ingest funnel event.
 *
 * Idempotency:
 * - one event per storeId + sessionId + eventType + entityId (optional)
 */
export const ingestConversionEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = getStoreObjectId(req, res);
    if (!storeId) return;

    const data = ingestSchema.parse(req.body);
    const entityId = data.entityId || null;
    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();

    // Map to FunnelEventType (keep legacy compatibility)
    const mappedEventType: FunnelEventType =
      data.eventType === 'PAYMENT_SUCCESS' ? 'PAYMENT_SUCCESS' : (data.eventType as FunnelEventType);

    const existing = await FunnelEvent.findOne({
      storeId,
      sessionId: data.sessionId,
      eventType: mappedEventType,
      entityId,
    }).lean();

    if (existing) {
      sendSuccess(res, { ok: true, deduped: true });
      return;
    }

    await FunnelEvent.create({
      storeId,
      sessionId: data.sessionId,
      userId: (req as any).user?.id || null,
      eventType: mappedEventType,
      entityId,
      occurredAt,
      device: data.device || 'unknown',
      source: data.source || null,
      pagePath: data.pagePath || null,
      metadata: data.metadata || {},
    });

    sendSuccess(res, { ok: true }, 'Event recorded', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Build a $match for FunnelEvent based on store + range + optional filters.
 */
function buildEventMatch(storeId: mongoose.Types.ObjectId, q: { start: string; end: string; device?: string; source?: string }) {
  const match: any = {
    storeId,
    occurredAt: getEventTimeMatch(q.start, q.end),
    eventType: {
      $in: [
        'PAGE_VIEW',
        'PRODUCT_VIEW',
        'ADD_TO_CART',
        'CHECKOUT_STARTED',
        'PAYMENT_SUCCESS',
        // legacy fallback
        'ORDER_CONFIRMED',
      ],
    },
  };
  if (q.device) match.device = q.device;
  if (q.source) match.source = q.source;
  return match;
}

/**
 * GET /analytics/conversion/overview
 * KPI cards: sessions at each stage + overall conversion rate + drop-off rates.
 */
export const getConversionOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = getStoreObjectId(req, res);
    if (!storeId) return;

    const parsed = dateRangeSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      device: req.query.device,
      source: req.query.source,
    });

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const funnel = await computeSessionFunnel(storeId, { start, end, device: parsed.device, source: parsed.source });

    const overallConversionRate = funnel.steps[0]?.count
      ? (funnel.steps[funnel.steps.length - 1].count / funnel.steps[0].count) * 100
      : 0;

    sendSuccess(res, {
      summary: {
        sessions: funnel.steps[0]?.count || 0,
        productViewSessions: funnel.steps[1]?.count || 0,
        addToCartSessions: funnel.steps[2]?.count || 0,
        checkoutSessions: funnel.steps[3]?.count || 0,
        paymentSuccessSessions: funnel.steps[4]?.count || 0,
        overallConversionRate: parseFloat(overallConversionRate.toFixed(2)),
      },
      funnel: funnel.steps,
      dateRange: { start, end },
      filters: { device: parsed.device || null, source: parsed.source || null },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/conversion/funnel
 */
export const getConversionFunnel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = getStoreObjectId(req, res);
    if (!storeId) return;

    const parsed = dateRangeSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      device: req.query.device,
      source: req.query.source,
    });

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const funnel = await computeSessionFunnel(storeId, { start, end, device: parsed.device, source: parsed.source });
    sendSuccess(res, { funnel: funnel.steps, dateRange: { start, end }, filters: { device: parsed.device || null, source: parsed.source || null } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/conversion/trend
 * Line chart of conversion rate over time.
 *
 * Definition:
 * - denominator: sessions with PAGE_VIEW in bucket
 * - numerator: sessions that reached PAYMENT_SUCCESS (or ORDER_CONFIRMED) in bucket
 * Bucket assignment uses the PAGE_VIEW time (session start).
 */
export const getConversionTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = getStoreObjectId(req, res);
    if (!storeId) return;

    const parsed = trendSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      device: req.query.device,
      source: req.query.source,
      interval: req.query.interval,
    });

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const match = buildEventMatch(storeId, { start, end, device: parsed.device, source: parsed.source });

    const truncUnit = parsed.interval === 'daily' ? 'day' : parsed.interval === 'weekly' ? 'week' : 'month';

    const data = await FunnelEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$sessionId',
          pageAt: { $min: { $cond: [{ $eq: ['$eventType', 'PAGE_VIEW'] }, '$occurredAt', null] } },
          payAt: {
            $min: {
              $cond: [{ $in: ['$eventType', ['PAYMENT_SUCCESS', 'ORDER_CONFIRMED']] }, '$occurredAt', null],
            },
          },
        },
      },
      { $match: { pageAt: { $ne: null } } },
      {
        $project: {
          bucket: {
            $dateTrunc: { date: '$pageAt', unit: truncUnit, binSize: 1, timezone: 'UTC' },
          },
          converted: { $cond: [{ $and: [{ $ne: ['$payAt', null] }, { $gte: ['$payAt', '$pageAt'] }] }, 1, 0] },
        },
      },
      {
        $group: {
          _id: '$bucket',
          sessions: { $sum: 1 },
          converted: { $sum: '$converted' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { date: '$_id', format: '%Y-%m-%d', timezone: 'UTC' } },
          sessions: 1,
          converted: 1,
          conversionRate: {
            $cond: [{ $eq: ['$sessions', 0] }, 0, { $multiply: [{ $divide: ['$converted', '$sessions'] }, 100] }],
          },
        },
      },
    ]);

    sendSuccess(res, {
      interval: parsed.interval,
      data: data.map((d: any) => ({ ...d, conversionRate: parseFloat(Number(d.conversionRate).toFixed(2)) })),
      dateRange: { start, end },
      filters: { device: parsed.device || null, source: parsed.source || null },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/conversion/breakdown
 * Breakdown by device and/or source.
 *
 * Query:
 * - groupBy=device|source (default: device)
 */
export const getConversionBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = getStoreObjectId(req, res);
    if (!storeId) return;

    const parsed = dateRangeSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      device: req.query.device,
      source: req.query.source,
    });

    const groupBy = (req.query.groupBy as string) || 'device';
    if (groupBy !== 'device' && groupBy !== 'source') {
      sendError(res, 'Invalid groupBy. Use device|source', 400);
      return;
    }

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    const match = buildEventMatch(storeId, { start, end, device: parsed.device, source: parsed.source });

    const groupField = groupBy === 'device' ? '$device' : '$source';

    const rows = await FunnelEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            sessionId: '$sessionId',
            key: groupField,
          },
          pageAt: { $min: { $cond: [{ $eq: ['$eventType', 'PAGE_VIEW'] }, '$occurredAt', null] } },
          payAt: {
            $min: {
              $cond: [{ $in: ['$eventType', ['PAYMENT_SUCCESS', 'ORDER_CONFIRMED']] }, '$occurredAt', null],
            },
          },
        },
      },
      { $match: { pageAt: { $ne: null } } },
      {
        $project: {
          key: '$_id.key',
          converted: { $cond: [{ $and: [{ $ne: ['$payAt', null] }, { $gte: ['$payAt', '$pageAt'] }] }, 1, 0] },
        },
      },
      {
        $group: {
          _id: '$key',
          sessions: { $sum: 1 },
          converted: { $sum: '$converted' },
        },
      },
      { $sort: { sessions: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          key: { $ifNull: ['$_id', 'unknown'] },
          sessions: 1,
          converted: 1,
          conversionRate: {
            $cond: [{ $eq: ['$sessions', 0] }, 0, { $multiply: [{ $divide: ['$converted', '$sessions'] }, 100] }],
          },
        },
      },
    ]);

    sendSuccess(res, {
      groupBy,
      rows: rows.map((r: any) => ({ ...r, conversionRate: parseFloat(Number(r.conversionRate).toFixed(2)) })),
      dateRange: { start, end },
      filters: { device: parsed.device || null, source: parsed.source || null },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Session-based funnel computation (ordered).
 */
async function computeSessionFunnel(
  storeId: mongoose.Types.ObjectId,
  q: { start: string; end: string; device?: string; source?: string }
): Promise<{
  steps: Array<{
    step: string;
    count: number;
    dropOff: number;
    dropOffPercent: number;
    conversionRate: number;
  }>;
}> {
  const match = buildEventMatch(storeId, q);

  const [agg] = await FunnelEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$sessionId',
        pageAt: { $min: { $cond: [{ $eq: ['$eventType', 'PAGE_VIEW'] }, '$occurredAt', null] } },
        productAt: { $min: { $cond: [{ $eq: ['$eventType', 'PRODUCT_VIEW'] }, '$occurredAt', null] } },
        addAt: { $min: { $cond: [{ $eq: ['$eventType', 'ADD_TO_CART'] }, '$occurredAt', null] } },
        checkoutAt: { $min: { $cond: [{ $eq: ['$eventType', 'CHECKOUT_STARTED'] }, '$occurredAt', null] } },
        payAt: {
          $min: {
            $cond: [{ $in: ['$eventType', ['PAYMENT_SUCCESS', 'ORDER_CONFIRMED']] }, '$occurredAt', null],
          },
        },
      },
    },
    {
      $project: {
        reachedPage: { $cond: [{ $ne: ['$pageAt', null] }, 1, 0] },
        reachedProduct: {
          $cond: [{ $and: [{ $ne: ['$productAt', null] }, { $ne: ['$pageAt', null] }, { $gte: ['$productAt', '$pageAt'] }] }, 1, 0],
        },
        reachedAdd: {
          $cond: [
            {
              $and: [
                { $ne: ['$addAt', null] },
                { $ne: ['$productAt', null] },
                { $ne: ['$pageAt', null] },
                { $gte: ['$addAt', '$productAt'] },
              ],
            },
            1,
            0,
          ],
        },
        reachedCheckout: {
          $cond: [
            {
              $and: [
                { $ne: ['$checkoutAt', null] },
                { $ne: ['$addAt', null] },
                { $gte: ['$checkoutAt', '$addAt'] },
              ],
            },
            1,
            0,
          ],
        },
        reachedPay: {
          $cond: [
            {
              $and: [
                { $ne: ['$payAt', null] },
                { $ne: ['$checkoutAt', null] },
                { $gte: ['$payAt', '$checkoutAt'] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        page: { $sum: '$reachedPage' },
        product: { $sum: '$reachedProduct' },
        add: { $sum: '$reachedAdd' },
        checkout: { $sum: '$reachedCheckout' },
        pay: { $sum: '$reachedPay' },
      },
    },
  ]);

  const counts = agg || { page: 0, product: 0, add: 0, checkout: 0, pay: 0 };

  const stepsRaw = [
    { step: 'PAGE_VIEW', count: counts.page },
    { step: 'PRODUCT_VIEW', count: counts.product },
    { step: 'ADD_TO_CART', count: counts.add },
    { step: 'CHECKOUT_STARTED', count: counts.checkout },
    { step: 'PAYMENT_SUCCESS', count: counts.pay },
  ];

  const steps = stepsRaw.map((s, idx) => {
    if (idx === 0) {
      return { step: s.step, count: s.count, dropOff: 0, dropOffPercent: 0, conversionRate: 100 };
    }
    const prev = stepsRaw[idx - 1];
    const dropOff = Math.max(0, prev.count - s.count);
    const dropOffPercent = prev.count > 0 ? (dropOff / prev.count) * 100 : 0;
    const conversionRate = prev.count > 0 ? (s.count / prev.count) * 100 : 0;
    return {
      step: s.step,
      count: s.count,
      dropOff,
      dropOffPercent: parseFloat(dropOffPercent.toFixed(2)),
      conversionRate: parseFloat(conversionRate.toFixed(2)),
    };
  });

  return { steps };
}


