import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { PaymentSplit } from '../models/PaymentSplit';
import { CreditNote } from '../models/CreditNote';
import { SalesAnalyticsSnapshot } from '../models/SalesAnalyticsSnapshot';
import { RMA } from '../models/RMA';

/**
 * Sales Analytics Snapshot Generation Job
 *
 * PURPOSE:
 * - Generate pre-aggregated daily sales metrics
 * - Run hourly (for today) and daily (finalize yesterday)
 * - Use snapshot data for all analytics queries
 * - Never recompute historical data
 *
 * RULES:
 * - Only process confirmed/delivered orders
 * - One snapshot per day per scope per entity
 * - Append-only (never update historical snapshots)
 * - Use PaymentSplit for earnings
 * - Use CreditNote for refunds
 */

export interface SnapshotGenerationOptions {
  storeId?: mongoose.Types.ObjectId | string;
  date?: string; // YYYY-MM-DD format, defaults to today
  scope?: 'admin' | 'supplier' | 'reseller';
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
 * Generate snapshot for admin scope (all store orders)
 */
async function generateAdminSnapshot(
  storeId: mongoose.Types.ObjectId,
  date: string,
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if snapshot already exists
    if (!force) {
      const existing = await SalesAnalyticsSnapshot.findOne({
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

    // Get all confirmed/delivered orders for this store on this date
    const orders = await Order.find({
      storeId,
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: { $gte: start, $lt: end },
    }).lean();

    // Get payment splits for these orders
    const orderIds = orders.map((o) => o.orderId);
    const paymentSplits = await PaymentSplit.find({
      orderId: { $in: orderIds },
    }).lean();

    // Get credit notes (refunds) for these orders
    const creditNotes = await CreditNote.find({
      orderId: { $in: orderIds },
      status: 'issued',
    }).lean();

    // Calculate metrics
    let ordersCount = orders.length;
    let grossRevenue = 0;
    let netRevenue = 0;
    let taxCollected = 0;
    let shippingCollected = 0;
    let discounts = 0;
    let refunds = 0;
    let codAmount = 0;
    let supplierEarnings = 0;
    let resellerEarnings = 0;
    let platformEarnings = 0;
    let stripeRevenue = 0;
    let paypalRevenue = 0;
    let codRevenue = 0;

    // Process orders
    for (const order of orders) {
      grossRevenue += order.totalAmount || 0;
      netRevenue += order.subtotal || 0;
      taxCollected += order.taxTotal || 0;
      shippingCollected += order.shippingSnapshot?.totalShipping || order.shippingAmount || 0;
      discounts += order.discountAmount || 0;
      codAmount += order.codAmount || 0;

      // Payment method revenue
      if (order.paymentMethod === 'stripe') {
        stripeRevenue += order.grandTotal || 0;
      } else if (order.paymentMethod === 'paypal') {
        paypalRevenue += order.grandTotal || 0;
      } else if (order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') {
        codRevenue += order.grandTotal || 0;
      }
    }

    // Process payment splits for earnings
    for (const split of paymentSplits) {
      supplierEarnings += split.supplierAmount || 0;
      resellerEarnings += split.resellerAmount || 0;
      platformEarnings += split.platformAmount || 0;
    }

    // Process credit notes for refunds
    for (const creditNote of creditNotes) {
      refunds += Math.abs(creditNote.totalAmount || 0); // Credit notes are negative
    }

    // Create snapshot
    await SalesAnalyticsSnapshot.create({
      storeId,
      scope: 'admin',
      entityId: null,
      date,
      ordersCount,
      grossRevenue,
      netRevenue,
      taxCollected,
      shippingCollected,
      discounts,
      refunds,
      codAmount,
      supplierEarnings,
      resellerEarnings,
      platformEarnings,
      stripeRevenue,
      paypalRevenue,
      codRevenue,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate snapshot for supplier scope
 */
async function generateSupplierSnapshot(
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId,
  date: string,
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if snapshot already exists
    if (!force) {
      const existing = await SalesAnalyticsSnapshot.findOne({
        storeId,
        scope: 'supplier',
        entityId: supplierId,
        date,
      }).lean();

      if (existing) {
        return { success: true };
      }
    }

    const { start, end } = getDateRange(date);

    // Get orders fulfilled by this supplier
    const orders = await Order.find({
      storeId,
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: { $gte: start, $lt: end },
      $or: [
        { supplierId: supplierId },
        { 'fulfillmentSnapshot.items.supplierId': supplierId },
      ],
    }).lean();

    // Get payment splits for these orders
    const orderIds = orders.map((o) => o.orderId);
    const paymentSplits = await PaymentSplit.find({
      orderId: { $in: orderIds },
      supplierId: supplierId,
    }).lean();

    // Calculate metrics (only supplier earnings)
    let ordersCount = orders.length;
    let grossRevenue = 0;
    let netRevenue = 0;
    let taxCollected = 0;
    let shippingCollected = 0;
    let discounts = 0;
    let refunds = 0;
    let codAmount = 0;
    let supplierEarnings = 0;
    let resellerEarnings = 0;
    let platformEarnings = 0;
    let stripeRevenue = 0;
    let paypalRevenue = 0;
    let codRevenue = 0;

    // Process orders
    for (const order of orders) {
      grossRevenue += order.totalAmount || 0;
      netRevenue += order.subtotal || 0;
      taxCollected += order.taxTotal || 0;
      shippingCollected += order.shippingSnapshot?.totalShipping || order.shippingAmount || 0;
      discounts += order.discountAmount || 0;
      codAmount += order.codAmount || 0;

      if (order.paymentMethod === 'stripe') {
        stripeRevenue += order.grandTotal || 0;
      } else if (order.paymentMethod === 'paypal') {
        paypalRevenue += order.grandTotal || 0;
      } else if (order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') {
        codRevenue += order.grandTotal || 0;
      }
    }

    // Process payment splits (only supplier earnings)
    for (const split of paymentSplits) {
      supplierEarnings += split.supplierAmount || 0;
    }

    // Create snapshot
    await SalesAnalyticsSnapshot.create({
      storeId,
      scope: 'supplier',
      entityId: supplierId,
      date,
      ordersCount,
      grossRevenue,
      netRevenue,
      taxCollected,
      shippingCollected,
      discounts,
      refunds,
      codAmount,
      supplierEarnings,
      resellerEarnings: 0,
      platformEarnings: 0,
      stripeRevenue,
      paypalRevenue,
      codRevenue,
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
      const existing = await SalesAnalyticsSnapshot.findOne({
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
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: { $gte: start, $lt: end },
    }).lean();

    // Get payment splits for these orders
    const orderIds = orders.map((o) => o.orderId);
    const paymentSplits = await PaymentSplit.find({
      orderId: { $in: orderIds },
      resellerId: resellerId,
    }).lean();

    // Calculate metrics (only reseller earnings)
    let ordersCount = orders.length;
    let grossRevenue = 0;
    let netRevenue = 0;
    let taxCollected = 0;
    let shippingCollected = 0;
    let discounts = 0;
    let refunds = 0;
    let codAmount = 0;
    let supplierEarnings = 0;
    let resellerEarnings = 0;
    let platformEarnings = 0;
    let stripeRevenue = 0;
    let paypalRevenue = 0;
    let codRevenue = 0;

    // Process orders
    for (const order of orders) {
      grossRevenue += order.totalAmount || 0;
      netRevenue += order.subtotal || 0;
      taxCollected += order.taxTotal || 0;
      shippingCollected += order.shippingSnapshot?.totalShipping || order.shippingAmount || 0;
      discounts += order.discountAmount || 0;
      codAmount += order.codAmount || 0;

      if (order.paymentMethod === 'stripe') {
        stripeRevenue += order.grandTotal || 0;
      } else if (order.paymentMethod === 'paypal') {
        paypalRevenue += order.grandTotal || 0;
      } else if (order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') {
        codRevenue += order.grandTotal || 0;
      }
    }

    // Process payment splits (only reseller earnings)
    for (const split of paymentSplits) {
      resellerEarnings += split.resellerAmount || 0;
    }

    // Create snapshot
    await SalesAnalyticsSnapshot.create({
      storeId,
      scope: 'reseller',
      entityId: resellerId,
      date,
      ordersCount,
      grossRevenue,
      netRevenue,
      taxCollected,
      shippingCollected,
      discounts,
      refunds,
      codAmount,
      supplierEarnings: 0,
      resellerEarnings,
      platformEarnings: 0,
      stripeRevenue,
      paypalRevenue,
      codRevenue,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate snapshots for a specific date
 */
export async function generateSnapshots(
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
      } else if (options.scope === 'supplier' && options.entityId) {
        const supplierId = typeof options.entityId === 'string' 
          ? new mongoose.Types.ObjectId(options.entityId) 
          : options.entityId;
        const result = await generateSupplierSnapshot(storeId, supplierId, date, force);
        if (result.success) {
          snapshotsCreated++;
        } else {
          errors.push(result.error || 'Failed to generate supplier snapshot');
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
      // In production, you might want to iterate through all stores
      const { Store } = await import('../models/Store');
      const stores = await Store.find({}).select('_id').lean();

      for (const store of stores) {
        const result = await generateAdminSnapshot(new mongoose.Types.ObjectId(store._id), date, force);
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
export async function runHourlySnapshotGeneration(): Promise<SnapshotGenerationResult> {
  return generateSnapshots({
    date: formatDate(new Date()),
    force: false, // Don't force, but allow updates for today
  });
}

/**
 * Run snapshot generation for yesterday (daily job - finalize)
 */
export async function runDailySnapshotGeneration(): Promise<SnapshotGenerationResult> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return generateSnapshots({
    date: formatDate(yesterday),
    force: false, // Finalize yesterday's data
  });
}

