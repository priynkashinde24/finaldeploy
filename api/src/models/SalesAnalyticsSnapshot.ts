import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Sales Analytics Snapshot Model
 * 
 * PURPOSE:
 * - Pre-aggregated daily sales metrics for fast dashboard queries
 * - One snapshot per day per scope (admin/supplier/reseller)
 * - Append-only (never recompute historical data)
 * - Role-scoped for data isolation
 * 
 * RULES:
 * - One snapshot per day per scope per entity
 * - Never update historical snapshots
 * - Use for all analytics queries (no real-time aggregation)
 * - Snapshot data is immutable after creation
 */

export interface ISalesAnalyticsSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null; // Supplier ID or Reseller ID (null for admin)
  date: string; // YYYY-MM-DD format

  // Order metrics
  ordersCount: number;
  grossRevenue: number; // Total order value (before discounts)
  netRevenue: number; // Revenue after discounts, before tax
  taxCollected: number;
  shippingCollected: number;
  discounts: number; // Total discount amount
  refunds: number; // Total refund amount
  codAmount: number; // COD amount collected

  // Earnings breakdown
  supplierEarnings: number; // Supplier share (0 for admin/reseller scope)
  resellerEarnings: number; // Reseller share (0 for admin/supplier scope)
  platformEarnings: number; // Platform commission (0 for supplier/reseller scope)

  // Payment method breakdown
  stripeRevenue: number;
  paypalRevenue: number;
  codRevenue: number;

  createdAt: Date;
  updatedAt: Date;
}

const SalesAnalyticsSnapshotSchema: Schema = new Schema(
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
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
      index: true,
    },
    ordersCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
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
    taxCollected: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    shippingCollected: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discounts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    refunds: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    supplierEarnings: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    resellerEarnings: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    platformEarnings: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stripeRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paypalRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
SalesAnalyticsSnapshotSchema.index({ storeId: 1, scope: 1, date: -1 }); // Primary query pattern
SalesAnalyticsSnapshotSchema.index({ storeId: 1, scope: 1, entityId: 1, date: -1 }); // Entity-specific queries
SalesAnalyticsSnapshotSchema.index({ date: 1 }); // Date range queries
SalesAnalyticsSnapshotSchema.index({ scope: 1, entityId: 1, date: -1 }); // Cross-store entity queries

// Unique constraint: one snapshot per day per scope per entity
SalesAnalyticsSnapshotSchema.index(
  { storeId: 1, scope: 1, entityId: 1, date: 1 },
  { unique: true }
);

// Prevent updates and deletes (snapshots are immutable)
SalesAnalyticsSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('SalesAnalyticsSnapshot records are immutable and cannot be updated or deleted');
});

export const SalesAnalyticsSnapshot: Model<ISalesAnalyticsSnapshot> =
  mongoose.models.SalesAnalyticsSnapshot || mongoose.model<ISalesAnalyticsSnapshot>('SalesAnalyticsSnapshot', SalesAnalyticsSnapshotSchema);

