import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Inventory Aging Snapshot Model
 * 
 * PURPOSE:
 * - Track inventory age and movement for SKUs
 * - Identify slow-moving and dead stock
 * - One snapshot per SKU per day per scope
 * - Append-only (never recompute historical data)
 * 
 * RULES:
 * - One snapshot per SKU per day per scope per entity
 * - Age calculated from first stock date or last sale date
 * - Never update historical snapshots
 */

export interface IInventoryAgingSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;
  skuId: mongoose.Types.ObjectId;
  sku: string;
  productId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format

  // Inventory metrics
  stockLevel: number;
  stockValue: number; // stockLevel * costPrice
  averageCost: number;

  // Aging metrics
  daysSinceFirstStock: number; // Days since first stock entry
  daysSinceLastSale: number; // Days since last sale
  daysSinceLastMovement: number; // Days since last inventory movement

  // Movement metrics
  quantitySold: number; // Quantity sold in last 30 days
  quantityReceived: number; // Quantity received in last 30 days
  stockTurnover: number; // quantitySold / averageStock

  // Aging buckets
  ageBucket: 'fresh' | 'aging' | 'stale' | 'dead'; // 0-30, 31-60, 61-90, 90+ days
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  createdAt: Date;
  updatedAt: Date;
}

const InventoryAgingSnapshotSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['admin', 'supplier', 'reseller'],
      required: [true, 'Scope is required'],
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    skuId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: [true, 'SKU ID is required'],
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
      index: true,
    },
    stockLevel: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stockValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    averageCost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    daysSinceFirstStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    daysSinceLastSale: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    daysSinceLastMovement: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    quantitySold: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    quantityReceived: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stockTurnover: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    ageBucket: {
      type: String,
      enum: ['fresh', 'aging', 'stale', 'dead'],
      required: true,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
InventoryAgingSnapshotSchema.index({ storeId: 1, scope: 1, date: -1 });
InventoryAgingSnapshotSchema.index({ storeId: 1, scope: 1, entityId: 1, skuId: 1, date: -1 });
InventoryAgingSnapshotSchema.index({ skuId: 1, date: -1 });
InventoryAgingSnapshotSchema.index({ ageBucket: 1, riskLevel: 1, date: -1 });

// Unique constraint
InventoryAgingSnapshotSchema.index(
  { storeId: 1, scope: 1, entityId: 1, skuId: 1, date: 1 },
  { unique: true }
);

// Prevent updates and deletes
InventoryAgingSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('InventoryAgingSnapshot records are immutable and cannot be updated or deleted');
});

export const InventoryAgingSnapshot: Model<IInventoryAgingSnapshot> =
  mongoose.models.InventoryAgingSnapshot || mongoose.model<IInventoryAgingSnapshot>('InventoryAgingSnapshot', InventoryAgingSnapshotSchema);

