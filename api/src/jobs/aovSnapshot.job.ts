import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { PaymentSplit } from '../models/PaymentSplit';
import { CreditNote } from '../models/CreditNote';
import { AOVSnapshot } from '../models/AOVSnapshot';

/**
 * AOV Snapshot Generation Job
 *
 * PURPOSE:
 * - Generate pre-aggregated daily Average Order Value metrics
 * - Run hourly (for today) and daily (finalize yesterday)
 * - Use snapshot data for all analytics queries
 * - Never recompute historical data
 *
 * RULES:
 * - Only process confirmed/delivered orders
 * - One snapshot per day per scope per entity
 * - Append-only (never update historical snapshots)
 * - Calculate AOV from revenue and order counts
 */

export interface AOVSnapshotGenerationOptions {
  storeId?: mongoose.Types.ObjectId | string;
  date?: string; // YYYY-MM-DD format, defaults to today
  scope?: 'admin' | 'reseller' | 'supplier';
  entityId?: mongoose.Types.ObjectId | string;
  force?: boolean; // Force regeneration even if snapshot exists
}

export interface AOVSnapshotGenerationResult {
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
 * Calculate Gross Order Value (GOV)
 * GOV = subtotal + tax + shipping - discounts
 */
function calculateGOV(order: any): number {
  const subtotal = order.subtotal || 0;
  const tax = order.taxTotal || 0;
  const shipping = order.shippingSnapshot?.totalShipping || order.shippingAmount || 0;
  const discounts = order.discountAmount || 0;
  return subtotal + tax + shipping - discounts;
}

/**
 * Generate snapshot for admin scope
 */
async function generateAdminAOVSnapshot(
  storeId: mongoose.Types.ObjectId,
  date: string,
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if snapshot already exists
    if (!force) {
      const existing = await AOVSnapshot.findOne({
        storeId,
        scope: 'admin',
        entityId: null,
        date,
      }).lean();

      if (existing) {
        return { success: true };
      }
    }

    const { start, end } = getDateRange(date);

    // Get all confirmed/delivered orders for this store on this date
    const orders = await Order.find({
      storeId,
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: { $gte: start, $lt: end },
    }).lean();

    // Get credit notes (refunds) for these orders
    const orderIds = orders.map((o) => o.orderId);
    const creditNotes = await CreditNote.find({
      orderId: { $in: orderIds },
      status: 'issued',
    }).lean();

    // Calculate totals
    let ordersCount = orders.length;
    let grossRevenue = 0;
    let refunds = 0;
    let onlineOrdersCount = 0;
    let codOrdersCount = 0;
    let stripeOrdersCount = 0;
    let stripeRevenue = 0;
    let paypalOrdersCount = 0;
    let paypalRevenue = 0;
    let codRevenue = 0;

    // Process orders
    for (const order of orders) {
      const gov = calculateGOV(order);
      grossRevenue += gov;

      // Payment method breakdown
      if (order.paymentMethod === 'stripe') {
        stripeOrdersCount++;
        stripeRevenue += gov;
        onlineOrdersCount++;
      } else if (order.paymentMethod === 'paypal') {
        paypalOrdersCount++;
        paypalRevenue += gov;
        onlineOrdersCount++;
      } else if (order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') {
        codOrdersCount++;
        codRevenue += gov;
      }
    }

    // Process refunds
    for (const creditNote of creditNotes) {
      refunds += Math.abs(creditNote.totalAmount || 0);
    }

    const netRevenue = Math.max(0, grossRevenue - refunds);

    // Calculate AOV values
    const grossAOV = ordersCount > 0 ? grossRevenue / ordersCount : 0;
    const netAOV = ordersCount > 0 ? netRevenue / ordersCount : 0;
    const onlineAOV = onlineOrdersCount > 0 ? (stripeRevenue + paypalRevenue) / onlineOrdersCount : 0;
    const codAOV = codOrdersCount > 0 ? codRevenue / codOrdersCount : 0;
    const stripeAOV = stripeOrdersCount > 0 ? stripeRevenue / stripeOrdersCount : 0;
    const paypalAOV = paypalOrdersCount > 0 ? paypalRevenue / paypalOrdersCount : 0;

    // Create snapshot
    await AOVSnapshot.create({
      storeId,
      scope: 'admin',
      entityId: null,
      date,
      ordersCount,
      onlineOrdersCount,
      codOrdersCount,
      grossRevenue,
      netRevenue,
      refunds,
      grossAOV,
      netAOV,
      onlineAOV,
      codAOV,
      stripeOrdersCount,
      stripeRevenue,
      stripeAOV,
      paypalOrdersCount,
      paypalRevenue,
      paypalAOV,
      codRevenue,
      supplierRevenue: 0,
      supplierAOV: 0,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate snapshot for reseller scope
 */
async function generateResellerAOVSnapshot(
  storeId: mongoose.Types.ObjectId,
  resellerId: string,
  date: string,
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if snapshot already exists
    if (!force) {
      const existing = await AOVSnapshot.findOne({
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

    // Get credit notes (refunds) for these orders
    const orderIds = orders.map((o) => o.orderId);
    const creditNotes = await CreditNote.find({
      orderId: { $in: orderIds },
      status: 'issued',
    }).lean();

    // Calculate totals (same logic as admin)
    let ordersCount = orders.length;
    let grossRevenue = 0;
    let refunds = 0;
    let onlineOrdersCount = 0;
    let codOrdersCount = 0;
    let stripeOrdersCount = 0;
    let stripeRevenue = 0;
    let paypalOrdersCount = 0;
    let paypalRevenue = 0;
    let codRevenue = 0;

    for (const order of orders) {
      const gov = calculateGOV(order);
      grossRevenue += gov;

      if (order.paymentMethod === 'stripe') {
        stripeOrdersCount++;
        stripeRevenue += gov;
        onlineOrdersCount++;
      } else if (order.paymentMethod === 'paypal') {
        paypalOrdersCount++;
        paypalRevenue += gov;
        onlineOrdersCount++;
      } else if (order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') {
        codOrdersCount++;
        codRevenue += gov;
      }
    }

    for (const creditNote of creditNotes) {
      refunds += Math.abs(creditNote.totalAmount || 0);
    }

    const netRevenue = Math.max(0, grossRevenue - refunds);

    // Calculate AOV values
    const grossAOV = ordersCount > 0 ? grossRevenue / ordersCount : 0;
    const netAOV = ordersCount > 0 ? netRevenue / ordersCount : 0;
    const onlineAOV = onlineOrdersCount > 0 ? (stripeRevenue + paypalRevenue) / onlineOrdersCount : 0;
    const codAOV = codOrdersCount > 0 ? codRevenue / codOrdersCount : 0;
    const stripeAOV = stripeOrdersCount > 0 ? stripeRevenue / stripeOrdersCount : 0;
    const paypalAOV = paypalOrdersCount > 0 ? paypalRevenue / paypalOrdersCount : 0;

    // Create snapshot
    await AOVSnapshot.create({
      storeId,
      scope: 'reseller',
      entityId: resellerId,
      date,
      ordersCount,
      onlineOrdersCount,
      codOrdersCount,
      grossRevenue,
      netRevenue,
      refunds,
      grossAOV,
      netAOV,
      onlineAOV,
      codAOV,
      stripeOrdersCount,
      stripeRevenue,
      stripeAOV,
      paypalOrdersCount,
      paypalRevenue,
      paypalAOV,
      codRevenue,
      supplierRevenue: 0,
      supplierAOV: 0,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate snapshot for supplier scope
 */
async function generateSupplierAOVSnapshot(
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId,
  date: string,
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if snapshot already exists
    if (!force) {
      const existing = await AOVSnapshot.findOne({
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

    // Get payment splits for these orders (supplier share only)
    const orderIds = orders.map((o) => o.orderId);
    const paymentSplits = await PaymentSplit.find({
      orderId: { $in: orderIds },
      supplierId: supplierId,
    }).lean();

    // Calculate totals based on supplier share
    let ordersCount = orders.length;
    let supplierRevenue = 0;
    let onlineOrdersCount = 0;
    let codOrdersCount = 0;

    // Process payment splits (supplier share)
    for (const split of paymentSplits) {
      supplierRevenue += split.supplierAmount || 0;

      if (split.paymentMethod === 'stripe' || split.paymentMethod === 'paypal') {
        onlineOrdersCount++;
      } else if (split.paymentMethod === 'cod' || split.paymentMethod === 'cod_partial') {
        codOrdersCount++;
      }
    }

    // Calculate supplier AOV
    const supplierAOV = ordersCount > 0 ? supplierRevenue / ordersCount : 0;

    // For supplier scope, we track supplier share, not total order value
    // Gross and net revenue are based on supplier share
    const grossRevenue = supplierRevenue;
    const netRevenue = supplierRevenue; // Refunds would reduce supplier share proportionally

    // Create snapshot
    await AOVSnapshot.create({
      storeId,
      scope: 'supplier',
      entityId: supplierId,
      date,
      ordersCount,
      onlineOrdersCount,
      codOrdersCount,
      grossRevenue,
      netRevenue,
      refunds: 0, // Refunds handled at order level, not supplier level
      grossAOV: supplierAOV,
      netAOV: supplierAOV,
      onlineAOV: onlineOrdersCount > 0 ? supplierRevenue / onlineOrdersCount : 0,
      codAOV: codOrdersCount > 0 ? supplierRevenue / codOrdersCount : 0,
      stripeOrdersCount: 0,
      stripeRevenue: 0,
      stripeAOV: 0,
      paypalOrdersCount: 0,
      paypalRevenue: 0,
      paypalAOV: 0,
      codRevenue: 0,
      supplierRevenue,
      supplierAOV,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate snapshots for a specific date
 */
export async function generateAOVSnapshots(
  options: AOVSnapshotGenerationOptions = {}
): Promise<AOVSnapshotGenerationResult> {
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
        const result = await generateAdminAOVSnapshot(storeId, date, force);
        if (result.success) {
          snapshotsCreated++;
        } else {
          errors.push(result.error || 'Failed to generate admin snapshot');
        }
      } else if (options.scope === 'reseller' && options.entityId) {
        const resellerId = options.entityId.toString();
        const result = await generateResellerAOVSnapshot(storeId, resellerId, date, force);
        if (result.success) {
          snapshotsCreated++;
        } else {
          errors.push(result.error || 'Failed to generate reseller snapshot');
        }
      } else if (options.scope === 'supplier' && options.entityId) {
        const supplierId = typeof options.entityId === 'string' 
          ? new mongoose.Types.ObjectId(options.entityId) 
          : options.entityId;
        const result = await generateSupplierAOVSnapshot(storeId, supplierId, date, force);
        if (result.success) {
          snapshotsCreated++;
        } else {
          errors.push(result.error || 'Failed to generate supplier snapshot');
        }
      }
    } else {
      // Generate for all stores (admin scope only for now)
      const { Store } = await import('../models/Store');
      const stores = await Store.find({}).select('_id').lean();

      for (const store of stores) {
        const storeObjId = typeof store._id === 'string' ? new mongoose.Types.ObjectId(store._id) : store._id;
        const result = await generateAdminAOVSnapshot(storeObjId, date, force);
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
export async function runHourlyAOVSnapshot(): Promise<AOVSnapshotGenerationResult> {
  return generateAOVSnapshots({
    date: formatDate(new Date()),
    force: false,
  });
}

/**
 * Run snapshot generation for yesterday (daily job - finalize)
 */
export async function runDailyAOVSnapshot(): Promise<AOVSnapshotGenerationResult> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return generateAOVSnapshots({
    date: formatDate(yesterday),
    force: false,
  });
}

