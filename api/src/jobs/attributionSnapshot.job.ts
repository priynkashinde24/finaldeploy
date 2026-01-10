import mongoose from 'mongoose';
import { AttributionSnapshot } from '../models/AttributionSnapshot';
import { MarketingTouch } from '../models/MarketingTouch';
import { AttributionSession } from '../models/AttributionSession';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { MarketingCost } from '../models/MarketingCost';
import { AttributionModel } from '../models/AttributionSnapshot';
import { logAudit } from '../utils/auditLogger';
import { calculateAttribution } from '../utils/attributionEngine';

/**
 * Attribution Snapshot Generation Job
 * 
 * PURPOSE:
 * - Pre-aggregate daily attribution metrics by channel
 * - Support multiple attribution models
 * - Calculate ROI when cost data is available
 * 
 * RUNS:
 * - Hourly (today)
 * - Daily (finalize yesterday)
 */

export interface AttributionSnapshotOptions {
  storeId?: mongoose.Types.ObjectId | string;
  date?: string; // YYYY-MM-DD format
  force?: boolean;
}

export interface AttributionSnapshotResult {
  success: boolean;
  snapshotsCreated: number;
  errors: string[];
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(dateString: string): { start: Date; end: Date } {
  const start = new Date(dateString + 'T00:00:00.000Z');
  const end = new Date(dateString + 'T23:59:59.999Z');
  return { start, end };
}

/**
 * Generate attribution snapshots for a store and date
 */
async function generateAttributionSnapshots(
  storeId: mongoose.Types.ObjectId,
  date: string,
  force: boolean
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];

  try {
    const { start, end } = getDateRange(date);

    // Get all marketing touches for this date
    const touches = await MarketingTouch.find({
      storeId,
      occurredAt: { $gte: start, $lte: end },
    }).lean();

    // Get all orders with attribution for this date
    const orders = await Order.find({
      storeId,
      createdAt: { $gte: start, $lte: end },
      marketingAttribution: { $exists: true, $ne: null },
      orderStatus: { $in: ['confirmed', 'delivered'] },
    }).lean();

    // Get all signups with attribution for this date
    const signups = await User.find({
      marketingAttribution: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
    }).lean();

    // Get marketing costs for this date
    const costs = await MarketingCost.find({
      storeId,
      date,
    }).lean();

    // Group costs by channel
    const costMap = new Map<string, number>();
    for (const cost of costs) {
      const key = cost.channel;
      costMap.set(key, (costMap.get(key) || 0) + cost.cost);
    }

    // Preload touchId -> sessionId mapping for converting orders (to avoid per-order lookups)
    const touchIdSet = new Set<string>();
    for (const order of orders) {
      const firstId = order.marketingAttribution?.firstTouch?.touchId?.toString?.();
      const lastId = order.marketingAttribution?.lastTouch?.touchId?.toString?.();
      if (firstId) touchIdSet.add(firstId);
      if (lastId) touchIdSet.add(lastId);
    }

    const touchIdList = Array.from(touchIdSet).map((id) => new mongoose.Types.ObjectId(id));
    const touchDocs = touchIdList.length
      ? await MarketingTouch.find({ _id: { $in: touchIdList } }).select('_id sessionId channel').lean()
      : [];
    const touchById = new Map<string, { sessionId: string; channel: string }>();
    for (const t of touchDocs) {
      touchById.set(t._id.toString(), { sessionId: t.sessionId, channel: t.channel });
    }

    // Cache multi-touch credits per session+model (job-local)
    const creditsCache = new Map<string, Array<{ channel: string; credit: number }>>();

    // Process each attribution model
    const models: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay'];

    for (const model of models) {
      // Group touches by channel
      const channelTouchMap = new Map<string, Set<string>>(); // channel -> set of sessionIds
      const channelSignupMap = new Map<string, number>();
      const channelOrderMap = new Map<string, { count: number; revenue: number }>(); // count can be fractional for multi-touch

      // Process touches
      for (const touch of touches) {
        const channel = touch.channel;
        if (!channelTouchMap.has(channel)) {
          channelTouchMap.set(channel, new Set());
        }
        channelTouchMap.get(channel)!.add(touch.sessionId);
      }

      // Process signups
      for (const signup of signups) {
        if (!signup.marketingAttribution) continue;

        let channel: string | undefined;
        if (model === 'first_touch') {
          channel = signup.marketingAttribution.firstTouch?.channel;
        } else {
          channel = signup.marketingAttribution.lastTouch?.channel || signup.marketingAttribution.signupChannel;
        }

        if (channel) {
          channelSignupMap.set(channel, (channelSignupMap.get(channel) || 0) + 1);
        }
      }

      // Process orders
      for (const order of orders) {
        if (!order.marketingAttribution) continue;

        const revenue = order.grandTotal || order.totalAmountWithTax || 0;

        if (model === 'first_touch') {
          const channel = order.marketingAttribution.firstTouch?.channel;
          if (!channel) continue;
          const existing = channelOrderMap.get(channel) || { count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += revenue;
          channelOrderMap.set(channel, existing);
          continue;
        }

        if (model === 'last_touch') {
          const channel = order.marketingAttribution.lastTouch?.channel;
          if (!channel) continue;
          const existing = channelOrderMap.get(channel) || { count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += revenue;
          channelOrderMap.set(channel, existing);
          continue;
        }

        // Multi-touch models: compute credits from session touches (offline, job-time)
        const anchorTouchId =
          order.marketingAttribution.lastTouch?.touchId?.toString?.() ||
          order.marketingAttribution.firstTouch?.touchId?.toString?.();
        const anchor = anchorTouchId ? touchById.get(anchorTouchId) : null;
        const sessionId = anchor?.sessionId;

        if (!sessionId) {
          // fallback to last-touch channel if session can't be resolved
          const fallbackChannel = order.marketingAttribution.lastTouch?.channel;
          if (!fallbackChannel) continue;
          const existing = channelOrderMap.get(fallbackChannel) || { count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += revenue;
          channelOrderMap.set(fallbackChannel, existing);
          continue;
        }

        const cacheKey = `${model}:${sessionId}`;
        let credits = creditsCache.get(cacheKey);
        if (!credits) {
          const computed = await calculateAttribution(sessionId, model);
          credits = computed.map((c) => ({ channel: c.channel, credit: c.credit }));
          creditsCache.set(cacheKey, credits);
        }

        if (!credits || credits.length === 0) {
          const fallbackChannel = order.marketingAttribution.lastTouch?.channel || 'unknown';
          const existing = channelOrderMap.get(fallbackChannel) || { count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += revenue;
          channelOrderMap.set(fallbackChannel, existing);
          continue;
        }

        for (const c of credits) {
          const existing = channelOrderMap.get(c.channel) || { count: 0, revenue: 0 };
          existing.count += c.credit;
          existing.revenue += revenue * c.credit;
          channelOrderMap.set(c.channel, existing);
        }
      }

      // Create snapshots for each channel
      const allChannels = new Set([
        ...Array.from(channelTouchMap.keys()),
        ...Array.from(channelSignupMap.keys()),
        ...Array.from(channelOrderMap.keys()),
      ]);

      for (const channel of allChannels) {
        const visits = channelTouchMap.get(channel)?.size || 0;
        const uniqueVisitors = visits; // Simplified (can be enhanced with actual unique visitor tracking)
        const signups = channelSignupMap.get(channel) || 0;
        const orders = channelOrderMap.get(channel)?.count || 0;
        const revenue = channelOrderMap.get(channel)?.revenue || 0;
        const conversionRate = visits > 0 ? (orders / visits) * 100 : 0;
        const averageOrderValue = orders > 0 ? revenue / orders : 0;
        const cost = costMap.get(channel) || 0;
        const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : undefined;

        // Check if snapshot already exists
        if (!force) {
          const existing = await AttributionSnapshot.findOne({
            storeId,
            date,
            channel,
            attributionModel: model,
          }).lean();

          if (existing) {
            continue; // Skip if already exists
          }
        }

        // Create snapshot
        await AttributionSnapshot.create({
          storeId,
          date,
          channel,
          attributionModel: model,
          visits,
          uniqueVisitors,
          signups,
          orders,
          conversionRate,
          revenue,
          averageOrderValue,
          cost: cost > 0 ? cost : undefined,
          roi,
        });

        created++;
      }
    }
  } catch (error: any) {
    errors.push(`Error generating snapshots: ${error.message}`);
  }

  return { created, errors };
}

/**
 * Run attribution snapshot generation
 */
export async function runAttributionSnapshotGeneration(
  options: AttributionSnapshotOptions = {}
): Promise<AttributionSnapshotResult> {
  const result: AttributionSnapshotResult = {
    success: true,
    snapshotsCreated: 0,
    errors: [],
  };

  try {
    const date = options.date || formatDate(new Date());
    const force = options.force || false;

    if (options.storeId) {
      // Process single store
      const storeId = typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId;
      const processResult = await generateAttributionSnapshots(storeId, date, force);
      result.snapshotsCreated += processResult.created;
      result.errors.push(...processResult.errors);
    } else {
      // Process all stores (get from touches)
      const storeIds = await MarketingTouch.distinct('storeId').lean();
      const storeObjectIds = storeIds.map((id) => new mongoose.Types.ObjectId(id.toString()));

      for (const storeId of storeObjectIds) {
        const processResult = await generateAttributionSnapshots(storeId, date, force);
        result.snapshotsCreated += processResult.created;
        result.errors.push(...processResult.errors);
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Fatal error: ${error.message}`);
  }

  return result;
}

