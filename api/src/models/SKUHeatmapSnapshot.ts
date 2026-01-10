import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SKU Heatmap Snapshot Model
 * 
 * PURPOSE:
 * - Pre-aggregated daily SKU performance metrics
 * - One snapshot per SKU per day per scope (admin/supplier/reseller)
 * - Append-only (never recompute historical data)
 * - Used for heatmap visualization and SKU analytics
 * 
 * RULES:
 * - One snapshot per SKU per day per scope per entity
 * - Metrics calculated from events, orders, returns, inventory
 * - Never update historical snapshots
 */

export interface ISKUHeatmapSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null; // Supplier ID or Reseller ID (null for admin)
  skuId: mongoose.Types.ObjectId; // ProductVariant._id
  sku: string; // SKU string for quick reference
  productId: mongoose.Types.ObjectId; // Product._id
  date: string; // YYYY-MM-DD format

  // Demand metrics
  views: number; // Product views (from FunnelEvent)
  addToCart: number; // Add to cart events
  ordersCount: number; // Number of orders containing this SKU
  quantitySold: number; // Total quantity sold

  // Revenue metrics
  grossRevenue: number; // Total revenue from this SKU
  netRevenue: number; // Gross revenue - returns
  aovContribution: number; // Average contribution to order value

  // Risk metrics
  returnsCount: number; // Number of returns
  cancellationsCount: number; // Number of cancellations
  codFailureCount: number; // COD orders that failed

  // Inventory metrics
  stockLevel: number; // Current stock level (at snapshot time)
  stockTurnover: number; // quantitySold / averageStock (if available)
  daysOfInventory: number; // stockLevel / averageDailySales

  // Derived metrics
  conversionRate: number; // (ordersCount / views) * 100
  returnRate: number; // (returnsCount / ordersCount) * 100
  cancellationRate: number; // (cancellationsCount / ordersCount) * 100
  codFailureRate: number; // (codFailureCount / codOrdersCount) * 100
  viewToCartRate: number; // (addToCart / views) * 100
  cartToOrderRate: number; // (ordersCount / addToCart) * 100

  createdAt: Date;
  updatedAt: Date;
}

const SKUHeatmapSnapshotSchema: Schema = new Schema(
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
      type: Schema.Types.Mixed, // Can be ObjectId or string
      default: null,
      index: true,
      // Supplier ID for supplier scope, Reseller ID for reseller scope, null for admin
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
    // Demand metrics
    views: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    addToCart: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    ordersCount: {
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
    // Revenue metrics
    grossRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    netRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    aovContribution: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // Risk metrics
    returnsCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    cancellationsCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codFailureCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // Inventory metrics
    stockLevel: {
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
    daysOfInventory: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // Derived metrics
    conversionRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    returnRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    cancellationRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    codFailureRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    viewToCartRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    cartToOrderRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
SKUHeatmapSnapshotSchema.index({ storeId: 1, scope: 1, date: -1 }); // Primary query pattern
SKUHeatmapSnapshotSchema.index({ storeId: 1, scope: 1, entityId: 1, date: -1 }); // Entity-specific queries
SKUHeatmapSnapshotSchema.index({ skuId: 1, date: -1 }); // SKU-specific queries
SKUHeatmapSnapshotSchema.index({ storeId: 1, skuId: 1, date: -1 }); // Store + SKU queries
SKUHeatmapSnapshotSchema.index({ date: 1 }); // Date range queries

// Unique constraint: one snapshot per SKU per day per scope per entity
SKUHeatmapSnapshotSchema.index(
  { storeId: 1, scope: 1, entityId: 1, skuId: 1, date: 1 },
  { unique: true }
);

// Prevent updates and deletes (snapshots are immutable)
SKUHeatmapSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('SKUHeatmapSnapshot records are immutable and cannot be updated or deleted');
});

export const SKUHeatmapSnapshot: Model<ISKUHeatmapSnapshot> =
  mongoose.models.SKUHeatmapSnapshot || mongoose.model<ISKUHeatmapSnapshot>('SKUHeatmapSnapshot', SKUHeatmapSnapshotSchema);

