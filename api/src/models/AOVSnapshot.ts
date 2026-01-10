import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * AOV Snapshot Model
 * 
 * PURPOSE:
 * - Pre-aggregated daily Average Order Value metrics
 * - One snapshot per day per scope (admin/reseller/supplier)
 * - Append-only (never recompute historical data)
 * - Used for fast dashboard queries
 * 
 * RULES:
 * - One snapshot per day per scope per entity
 * - AOV calculated from revenue and order counts
 * - Never update historical snapshots
 */

export interface IAOVSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'reseller' | 'supplier';
  entityId?: mongoose.Types.ObjectId | string | null; // Reseller ID or Supplier ID (null for admin)
  date: string; // YYYY-MM-DD format

  // Order counts
  ordersCount: number;
  onlineOrdersCount: number; // Stripe + PayPal
  codOrdersCount: number; // COD orders

  // Revenue totals
  grossRevenue: number; // Order subtotal + tax + shipping - discounts
  netRevenue: number; // Gross revenue - refunds
  refunds: number; // Total refund amount

  // Computed AOV values
  grossAOV: number; // grossRevenue / ordersCount
  netAOV: number; // netRevenue / ordersCount
  onlineAOV: number; // Gross revenue from online orders / onlineOrdersCount
  codAOV: number; // Gross revenue from COD orders / codOrdersCount

  // Breakdown by payment method
  stripeOrdersCount: number;
  stripeRevenue: number;
  stripeAOV: number;

  paypalOrdersCount: number;
  paypalRevenue: number;
  paypalAOV: number;

  codRevenue: number;

  // Supplier-specific (only for supplier scope)
  supplierRevenue: number; // Supplier share from payment splits
  supplierAOV: number; // supplierRevenue / ordersCount

  createdAt: Date;
  updatedAt: Date;
}

const AOVSnapshotSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['admin', 'reseller', 'supplier'],
      required: [true, 'Scope is required'],
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
      default: null,
      index: true,
      // Reseller ID for reseller scope, Supplier ID for supplier scope, null for admin
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
    onlineOrdersCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codOrdersCount: {
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
    refunds: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    grossAOV: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    netAOV: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    onlineAOV: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codAOV: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stripeOrdersCount: {
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
    stripeAOV: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paypalOrdersCount: {
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
    paypalAOV: {
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
    supplierRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    supplierAOV: {
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
AOVSnapshotSchema.index({ storeId: 1, scope: 1, date: -1 }); // Primary query pattern
AOVSnapshotSchema.index({ storeId: 1, scope: 1, entityId: 1, date: -1 }); // Entity-specific queries
AOVSnapshotSchema.index({ date: 1 }); // Date range queries

// Unique constraint: one snapshot per day per scope per entity
AOVSnapshotSchema.index(
  { storeId: 1, scope: 1, entityId: 1, date: 1 },
  { unique: true }
);

// Prevent updates and deletes (snapshots are immutable)
AOVSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('AOVSnapshot records are immutable and cannot be updated or deleted');
});

export const AOVSnapshot: Model<IAOVSnapshot> =
  mongoose.models.AOVSnapshot || mongoose.model<IAOVSnapshot>('AOVSnapshot', AOVSnapshotSchema);

