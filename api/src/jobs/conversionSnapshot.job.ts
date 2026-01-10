import mongoose from 'mongoose';
import { FunnelEvent } from '../models/FunnelEvent';
import { ConversionSnapshot } from '../models/ConversionSnapshot';
import { Order } from '../models/Order';
import { Cart } from '../models/Cart';
import { CartRecoveryToken } from '../models/CartRecoveryToken';

/**
 * Conversion Snapshot Generation Job
 *
 * PURPOSE:
 * - Generate pre-aggregated daily conversion funnel metrics
 * - Run hourly (for today) and daily (finalize yesterday)
 * - Use snapshot data for all analytics queries
 * - Never recompute historical data
 *
 * RULES:
 * - Only process events for confirmed/delivered orders
 * - One snapshot per day per scope per entity
 * - Append-only (never update historical snapshots)
 */

export interface SnapshotGenerationOptions {
  storeId?: mongoose.Types.ObjectId | string;
  date?: string; // YYYY-MM-DD format, defaults to today
  scope?: 'admin' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string;
  force?: boolean; // Force regeneration even if snapshot exists
}

export interface SnapshotGenerationResult {
  success: boolean;
  snapshotsCreated: number;
  errors: string[];
  duration: number;
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
 * Get date range for a day (start and end of day in UTC)
 */
function getDateRange(dateString: string): { start: Date; end: Date } {
  const date = new Date(dateString + 'T00:00:00.000Z');
  const start = new Date(date);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/**
 * Calculate conversion rate
 */
function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

/**
 * Generate snapshot for admin scope
 */
async function generateAdminSnapshot(
  storeId: mongoose.Types.ObjectId,
  date: string,
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if snapshot already exists
    if (!force) {
      const existing = await ConversionSnapshot.findOne({
        storeId,
        scope: 'admin',
        entityId: null,
        date,
      }).lean();

      if (existing) {
        return { success: true }; // Already exists, skip
      }
    }

    const { start, end } = getDateRange(date);

    // Get all funnel events for this store on this date
    const events = await FunnelEvent.find({
      storeId,
      createdAt: { $gte: start, $lt: end },
    }).lean();

    // Count events by type
    let pageViews = 0;
    let productViews = 0;
    let addToCart = 0;
    let cartView = 0;
    let checkoutStarted = 0;
    let paymentInitiated = 0;
    let ordersConfirmed = 0;

    // Payment method counts
    let stripeInitiated = 0;
    let paypalInitiated = 0;
    let codInitiated = 0;
    let stripeSuccess = 0;
    let paypalSuccess = 0;
    let codSuccess = 0;
    let paymentFailures = 0;

    // Count events
    for (const event of events) {
      switch (event.eventType) {
        case 'PAGE_VIEW':
          pageViews++;
          break;
        case 'PRODUCT_VIEW':
          productViews++;
          break;
        case 'ADD_TO_CART':
          addToCart++;
          break;
        case 'CART_VIEW':
          cartView++;
          break;
        case 'CHECKOUT_STARTED':
          checkoutStarted++;
          break;
        case 'PAYMENT_INITIATED':
          paymentInitiated++;
          const paymentMethod = event.metadata?.paymentMethod;
          if (paymentMethod === 'stripe') stripeInitiated++;
          else if (paymentMethod === 'paypal') paypalInitiated++;
          else if (paymentMethod === 'cod' || paymentMethod === 'cod_partial') codInitiated++;
          break;
        case 'ORDER_CONFIRMED':
          ordersConfirmed++;
          break;
      }
    }

    // Get orders for payment success/failure tracking
    const orders = await Order.find({
      storeId,
      createdAt: { $gte: start, $lt: end },
    }).lean();

    for (const order of orders) {
      if (order.orderStatus === 'confirmed' || order.orderStatus === 'delivered') {
        if (order.paymentMethod === 'stripe' && order.paymentStatus === 'paid') {
          stripeSuccess++;
        } else if (order.paymentMethod === 'paypal' && order.paymentStatus === 'paid') {
          paypalSuccess++;
        } else if ((order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') && order.paymentStatus === 'cod_collected') {
          codSuccess++;
        }
      } else if (order.paymentStatus === 'failed') {
        paymentFailures++;
      }
    }

    // Get abandoned carts
    const abandonedCarts = await Cart.countDocuments({
      storeId,
      status: 'abandoned',
      abandonedAt: { $gte: start, $lt: end },
    });

    // Get checkout abandonments (checkout started but no order)
    const checkoutSessions = new Set(
      events.filter((e) => e.eventType === 'CHECKOUT_STARTED').map((e) => e.sessionId)
    );
    const confirmedSessions = new Set(
      events.filter((e) => e.eventType === 'ORDER_CONFIRMED').map((e) => e.sessionId)
    );
    const checkoutAbandoned = Array.from(checkoutSessions).filter((s) => !confirmedSessions.has(s)).length;

    // Get recovery conversions
    const recoveryTokens = await CartRecoveryToken.find({
      storeId,
      createdAt: { $gte: start, $lt: end },
      converted: true,
    }).lean();
    const recoveryConverted = recoveryTokens.length;

    // Calculate rates
    const addToCartRate = calculateRate(addToCart, productViews);
    const checkoutConversionRate = calculateRate(checkoutStarted, addToCart);
    const paymentSuccessRate = calculateRate(paymentInitiated, checkoutStarted);
    const overallConversionRate = calculateRate(ordersConfirmed, pageViews);

    // Create snapshot
    await ConversionSnapshot.create({
      storeId,
      scope: 'admin',
      entityId: null,
      date,
      pageViews,
      productViews,
      addToCart,
      cartView,
      checkoutStarted,
      paymentInitiated,
      ordersConfirmed,
      addToCartRate,
      checkoutConversionRate,
      paymentSuccessRate,
      overallConversionRate,
      stripeInitiated,
      paypalInitiated,
      codInitiated,
      stripeSuccess,
      paypalSuccess,
      codSuccess,
      paymentFailures,
      cartAbandoned: abandonedCarts,
      checkoutAbandoned,
      recoveryConverted,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate snapshot for reseller scope
 */
async function generateResellerSnapshot(
  storeId: mongoose.Types.ObjectId,
  resellerId: string,
  date: string,
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if snapshot already exists
    if (!force) {
      const existing = await ConversionSnapshot.findOne({
        storeId,
        scope: 'reseller',
        entityId: resellerId,
        date,
      }).lean();

      if (existing) {
        return { success: true };
      }
    }

    const { start, end } = getDateRange(date);

    // Get orders for this reseller's store
    const orders = await Order.find({
      storeId,
      resellerId,
      createdAt: { $gte: start, $lt: end },
    }).select('orderId').lean();

    const orderIds = orders.map((o) => o.orderId);

    // Get funnel events for sessions that resulted in orders for this reseller
    // We need to track sessions that led to orders for this reseller
    const confirmedEvents = await FunnelEvent.find({
      storeId,
      eventType: 'ORDER_CONFIRMED',
      entityId: { $in: orderIds },
      createdAt: { $gte: start, $lt: end },
    }).lean();

    const sessionIds = new Set(confirmedEvents.map((e) => e.sessionId));

    // Get all events for these sessions
    const events = await FunnelEvent.find({
      storeId,
      sessionId: { $in: Array.from(sessionIds) },
      createdAt: { $gte: start, $lt: end },
    }).lean();

    // Count events (same logic as admin)
    let pageViews = 0;
    let productViews = 0;
    let addToCart = 0;
    let cartView = 0;
    let checkoutStarted = 0;
    let paymentInitiated = 0;
    let ordersConfirmed = confirmedEvents.length;

    let stripeInitiated = 0;
    let paypalInitiated = 0;
    let codInitiated = 0;
    let stripeSuccess = 0;
    let paypalSuccess = 0;
    let codSuccess = 0;
    let paymentFailures = 0;

    for (const event of events) {
      switch (event.eventType) {
        case 'PAGE_VIEW':
          pageViews++;
          break;
        case 'PRODUCT_VIEW':
          productViews++;
          break;
        case 'ADD_TO_CART':
          addToCart++;
          break;
        case 'CART_VIEW':
          cartView++;
          break;
        case 'CHECKOUT_STARTED':
          checkoutStarted++;
          break;
        case 'PAYMENT_INITIATED':
          paymentInitiated++;
          const paymentMethod = event.metadata?.paymentMethod;
          if (paymentMethod === 'stripe') stripeInitiated++;
          else if (paymentMethod === 'paypal') paypalInitiated++;
          else if (paymentMethod === 'cod' || paymentMethod === 'cod_partial') codInitiated++;
          break;
      }
    }

    // Get orders for this reseller (already have orderIds from above)
    const resellerOrders = orders;

    for (const order of resellerOrders) {
      if (order.orderStatus === 'confirmed' || order.orderStatus === 'delivered') {
        if (order.paymentMethod === 'stripe' && order.paymentStatus === 'paid') {
          stripeSuccess++;
        } else if (order.paymentMethod === 'paypal' && order.paymentStatus === 'paid') {
          paypalSuccess++;
        } else if ((order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') && order.paymentStatus === 'cod_collected') {
          codSuccess++;
        }
      } else if (order.paymentStatus === 'failed') {
        paymentFailures++;
      }
    }

    // Get abandoned carts for this store
    const abandonedCarts = await Cart.countDocuments({
      storeId,
      status: 'abandoned',
      abandonedAt: { $gte: start, $lt: end },
    });

    const checkoutSessions = new Set(
      events.filter((e) => e.eventType === 'CHECKOUT_STARTED').map((e) => e.sessionId)
    );
    const confirmedSessions = new Set(
      events.filter((e) => e.eventType === 'ORDER_CONFIRMED').map((e) => e.sessionId)
    );
    const checkoutAbandoned = Array.from(checkoutSessions).filter((s) => !confirmedSessions.has(s)).length;

    const recoveryTokens = await CartRecoveryToken.find({
      storeId,
      createdAt: { $gte: start, $lt: end },
      converted: true,
    }).lean();
    const recoveryConverted = recoveryTokens.length;

    // Calculate rates
    const addToCartRate = calculateRate(addToCart, productViews);
    const checkoutConversionRate = calculateRate(checkoutStarted, addToCart);
    const paymentSuccessRate = calculateRate(paymentInitiated, checkoutStarted);
    const overallConversionRate = calculateRate(ordersConfirmed, pageViews);

    // Create snapshot
    await ConversionSnapshot.create({
      storeId,
      scope: 'reseller',
      entityId: resellerId,
      date,
      pageViews,
      productViews,
      addToCart,
      cartView,
      checkoutStarted,
      paymentInitiated,
      ordersConfirmed,
      addToCartRate,
      checkoutConversionRate,
      paymentSuccessRate,
      overallConversionRate,
      stripeInitiated,
      paypalInitiated,
      codInitiated,
      stripeSuccess,
      paypalSuccess,
      codSuccess,
      paymentFailures,
      cartAbandoned: abandonedCarts,
      checkoutAbandoned,
      recoveryConverted,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate snapshots for a specific date
 */
export async function generateConversionSnapshots(
  options: SnapshotGenerationOptions = {}
): Promise<SnapshotGenerationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let snapshotsCreated = 0;

  try {
    const date = options.date || formatDate(new Date());
    const force = options.force || false;

    // If storeId is provided, generate for that store only
    if (options.storeId) {
      const storeId = typeof options.storeId === 'string' 
        ? new mongoose.Types.ObjectId(options.storeId) 
        : options.storeId;

      if (options.scope === 'admin') {
        const result = await generateAdminSnapshot(storeId, date, force);
        if (result.success) {
          snapshotsCreated++;
        } else {
          errors.push(result.error || 'Failed to generate admin snapshot');
        }
      } else if (options.scope === 'reseller' && options.entityId) {
        const resellerId = options.entityId.toString();
        const result = await generateResellerSnapshot(storeId, resellerId, date, force);
        if (result.success) {
          snapshotsCreated++;
        } else {
          errors.push(result.error || 'Failed to generate reseller snapshot');
        }
      }
    } else {
      // Generate for all stores (admin scope only for now)
      const { Store } = await import('../models/Store');
      const stores = await Store.find({}).select('_id').lean();

      for (const store of stores) {
        const storeObjId = typeof store._id === 'string' ? new mongoose.Types.ObjectId(store._id) : store._id;
        const result = await generateAdminSnapshot(storeObjId, date, force);
        if (result.success) {
          snapshotsCreated++;
        } else {
          errors.push(`Store ${store._id}: ${result.error || 'Failed'}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      snapshotsCreated,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      snapshotsCreated,
      errors: [...errors, error.message],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run snapshot generation for today (hourly job)
 */
export async function runHourlyConversionSnapshot(): Promise<SnapshotGenerationResult> {
  return generateConversionSnapshots({
    date: formatDate(new Date()),
    force: false, // Don't force, but allow updates for today
  });
}

/**
 * Run snapshot generation for yesterday (daily job - finalize)
 */
export async function runDailyConversionSnapshot(): Promise<SnapshotGenerationResult> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return generateConversionSnapshots({
    date: formatDate(yesterday),
    force: false, // Finalize yesterday's data
  });
}

