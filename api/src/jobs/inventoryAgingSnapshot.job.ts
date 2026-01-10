import mongoose from 'mongoose';
import { InventoryAgingSnapshot } from '../models/InventoryAgingSnapshot';
import { SupplierProduct } from '../models/SupplierProduct';
import { Order } from '../models/Order';
import { ProductVariant } from '../models/ProductVariant';

/**
 * Inventory Aging Snapshot Generation Job
 *
 * PURPOSE:
 * - Pre-aggregate daily inventory aging metrics per SKU
 * - Enables fast dead-stock dashboards without runtime joins
 *
 * DEFS:
 * - Completed orders: orderStatus in ['confirmed','delivered']
 * - Dead stock (dashboard): stockLevel > 0 AND daysSinceLastSale >= thresholdDays
 *
 * NOTES:
 * - Append-only: snapshot records are immutable (see model guard)
 * - This job currently generates ADMIN scope snapshots (store-wide) only
 */

export interface InventoryAgingSnapshotGenerationOptions {
  storeId?: mongoose.Types.ObjectId | string;
  date?: string; // YYYY-MM-DD, defaults to yesterday (finalized)
  force?: boolean; // if true, will attempt to write even if exists (may fail due to immutability/unique index)
}

export interface InventoryAgingSnapshotGenerationResult {
  success: boolean;
  snapshotsCreated: number;
  errors: string[];
  durationMs: number;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDayStartUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysBetween(ref: Date, past: Date): number {
  return Math.max(0, Math.floor((ref.getTime() - past.getTime()) / (1000 * 60 * 60 * 24)));
}

function getAgeBucket(daysSinceLastSale: number): 'fresh' | 'aging' | 'stale' | 'dead' {
  if (daysSinceLastSale <= 30) return 'fresh';
  if (daysSinceLastSale <= 60) return 'aging';
  if (daysSinceLastSale <= 90) return 'stale';
  return 'dead';
}

function getRiskLevel(bucket: 'fresh' | 'aging' | 'stale' | 'dead'): 'low' | 'medium' | 'high' | 'critical' {
  switch (bucket) {
    case 'fresh':
      return 'low';
    case 'aging':
      return 'medium';
    case 'stale':
      return 'high';
    case 'dead':
      return 'critical';
  }
}

async function generateAdminSnapshotsForStore(params: {
  storeId: mongoose.Types.ObjectId;
  date: string;
  force: boolean;
}): Promise<{ created: number; errors: string[] }> {
  const { storeId, date, force } = params;
  const errors: string[] = [];

  try {
    if (!force) {
      const exists = await InventoryAgingSnapshot.exists({
        storeId,
        scope: 'admin',
        entityId: null,
        date,
      });
      if (exists) return { created: 0, errors: [] };
    }

    // STEP 1: Aggregate inventory (stock + value) from SupplierProduct
    const inventory = await SupplierProduct.aggregate([
      {
        $match: {
          storeId,
          status: 'active',
          variantId: { $ne: null },
          stockQuantity: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$variantId',
          productId: { $first: '$productId' },
          stockLevel: { $sum: '$stockQuantity' },
          stockValue: { $sum: { $multiply: ['$stockQuantity', '$costPrice'] } },
          firstStockAt: { $min: '$createdAt' },
          lastMovementAt: { $max: '$updatedAt' },
        },
      },
    ]);

    if (inventory.length === 0) return { created: 0, errors: [] };

    const skuIds = inventory.map((i) => new mongoose.Types.ObjectId(i._id));

    // STEP 2: Bulk fetch variant metadata (SKU string and productId)
    const variants = await ProductVariant.find({ _id: { $in: skuIds }, status: 'active' })
      .select('_id sku productId')
      .lean();

    const variantMap = new Map<string, { sku: string; productId: mongoose.Types.ObjectId }>();
    for (const v of variants) {
      variantMap.set(v._id.toString(), { sku: v.sku, productId: v.productId as any });
    }

    // STEP 3: Compute last sale date per SKU (single aggregation)
    const lastSales = await Order.aggregate([
      {
        $match: {
          storeId,
          orderStatus: { $in: ['confirmed', 'delivered'] },
          'items.globalVariantId': { $in: skuIds },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.globalVariantId': { $in: skuIds } } },
      { $group: { _id: '$items.globalVariantId', lastSoldAt: { $max: '$createdAt' } } },
    ]);

    const lastSoldAtMap = new Map<string, Date>();
    for (const row of lastSales) {
      if (row?._id && row?.lastSoldAt) lastSoldAtMap.set(row._id.toString(), new Date(row.lastSoldAt));
    }

    // STEP 4: Quantity sold in last 30 days (units)
    const cutoff30 = new Date();
    cutoff30.setUTCDate(cutoff30.getUTCDate() - 30);
    const sold30 = await Order.aggregate([
      {
        $match: {
          storeId,
          orderStatus: { $in: ['confirmed', 'delivered'] },
          createdAt: { $gte: cutoff30 },
          'items.globalVariantId': { $in: skuIds },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.globalVariantId': { $in: skuIds } } },
      { $group: { _id: '$items.globalVariantId', quantitySold: { $sum: { $ifNull: ['$items.quantity', 0] } } } },
    ]);

    const sold30Map = new Map<string, number>();
    for (const row of sold30) {
      if (row?._id) sold30Map.set(row._id.toString(), Number(row.quantitySold || 0));
    }

    // Snapshot reference time: end of snapshot day (exclusive)
    const ref = addDaysUTC(parseDayStartUTC(date), 1);

    const docs: any[] = [];
    for (const inv of inventory) {
      const skuIdStr = inv._id?.toString?.() || String(inv._id);
      const variant = variantMap.get(skuIdStr);
      if (!variant) continue; // skip inactive/missing variants

      const stockLevel = Number(inv.stockLevel || 0);
      if (stockLevel <= 0) continue;

      const lastSoldAt = lastSoldAtMap.get(skuIdStr) || null;
      const daysSinceLastSale = lastSoldAt ? daysBetween(ref, lastSoldAt) : 999;

      const firstStockAt: Date | null = inv.firstStockAt ? new Date(inv.firstStockAt) : null;
      const lastMovementAt: Date | null = inv.lastMovementAt ? new Date(inv.lastMovementAt) : null;

      const daysSinceFirstStock = firstStockAt ? daysBetween(ref, firstStockAt) : 0;
      const daysSinceLastMovement = lastMovementAt ? daysBetween(ref, lastMovementAt) : daysSinceFirstStock;

      const ageBucket = getAgeBucket(daysSinceLastSale);
      const riskLevel = getRiskLevel(ageBucket);

      const quantitySold = sold30Map.get(skuIdStr) || 0;
      const stockTurnover = stockLevel > 0 ? quantitySold / stockLevel : 0;

      const stockValue = Number(inv.stockValue || 0);
      const averageCost = stockLevel > 0 ? stockValue / stockLevel : Number(inv.averageCost || 0);

      docs.push({
        storeId,
        scope: 'admin',
        entityId: null,
        skuId: new mongoose.Types.ObjectId(inv._id),
        sku: variant.sku,
        productId: variant.productId || inv.productId,
        date,
        stockLevel,
        stockValue,
        averageCost,
        daysSinceFirstStock,
        daysSinceLastSale,
        daysSinceLastMovement,
        quantitySold,
        quantityReceived: 0,
        stockTurnover,
        ageBucket,
        riskLevel,
      });
    }

    if (docs.length === 0) return { created: 0, errors: [] };

    try {
      await InventoryAgingSnapshot.insertMany(docs, { ordered: false });
      return { created: docs.length, errors: [] };
    } catch (e: any) {
      // If some duplicates exist, Mongo will throw bulk write error; treat as partial success.
      const msg = e?.message || String(e);
      errors.push(msg);
      return { created: 0, errors };
    }
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return { created: 0, errors };
  }
}

export async function runDailyInventoryAgingSnapshot(
  options: InventoryAgingSnapshotGenerationOptions = {}
): Promise<InventoryAgingSnapshotGenerationResult> {
  const start = Date.now();
  const force = options.force === true;

  const date =
    options.date ||
    (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      return formatDate(d);
    })();

  let snapshotsCreated = 0;
  const errors: string[] = [];

  try {
    if (options.storeId) {
      const storeId =
        typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId;
      const r = await generateAdminSnapshotsForStore({ storeId, date, force });
      snapshotsCreated += r.created;
      errors.push(...r.errors);
    } else {
      const { Store } = await import('../models/Store');
      const stores = await Store.find({}).select('_id').lean();
      for (const s of stores) {
        const storeId = new mongoose.Types.ObjectId(s._id);
        const r = await generateAdminSnapshotsForStore({ storeId, date, force });
        snapshotsCreated += r.created;
        errors.push(...r.errors.map((er) => `store ${s._id}: ${er}`));
      }
    }

    return {
      success: errors.length === 0,
      snapshotsCreated,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      success: false,
      snapshotsCreated,
      errors: [...errors, e?.message || String(e)],
      durationMs: Date.now() - start,
    };
  }
}


