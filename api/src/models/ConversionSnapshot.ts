import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Conversion Snapshot Model
 * 
 * PURPOSE:
 * - Pre-aggregated daily conversion funnel metrics
 * - One snapshot per day per scope (admin/reseller)
 * - Append-only (never recompute historical data)
 * - Used for fast dashboard queries
 * 
 * RULES:
 * - One snapshot per day per scope per entity
 * - Rates derived from counts
 * - Never update historical snapshots
 */

export interface IConversionSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null; // Reseller ID for reseller scope, null for admin
  date: string; // YYYY-MM-DD format

  // Event counts
  pageViews: number;
  productViews: number;
  addToCart: number;
  cartView: number;
  checkoutStarted: number;
  paymentInitiated: number;
  ordersConfirmed: number;

  // Conversion rates (derived from counts)
  addToCartRate: number; // addToCart / productViews
  checkoutConversionRate: number; // checkoutStarted / addToCart
  paymentSuccessRate: number; // paymentInitiated / checkoutStarted
  overallConversionRate: number; // ordersConfirmed / pageViews

  // Payment method breakdown
  stripeInitiated: number;
  paypalInitiated: number;
  codInitiated: number;
  stripeSuccess: number;
  paypalSuccess: number;
  codSuccess: number;
  paymentFailures: number;

  // Abandonment metrics
  cartAbandoned: number; // Carts that were abandoned
  checkoutAbandoned: number; // Checkouts started but not completed
  recoveryConverted: number; // Abandoned carts recovered via email/WhatsApp

  createdAt: Date;
  updatedAt: Date;
}

const ConversionSnapshotSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['admin', 'reseller'],
      required: [true, 'Scope is required'],
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
      default: null,
      index: true,
      // Reseller ID for reseller scope, null for admin
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
      index: true,
    },
    pageViews: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    productViews: {
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
    cartView: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    checkoutStarted: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paymentInitiated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    ordersConfirmed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    addToCartRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    checkoutConversionRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    paymentSuccessRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    overallConversionRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    stripeInitiated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paypalInitiated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codInitiated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stripeSuccess: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paypalSuccess: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codSuccess: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paymentFailures: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    cartAbandoned: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    checkoutAbandoned: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    recoveryConverted: {
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
ConversionSnapshotSchema.index({ storeId: 1, scope: 1, date: -1 }); // Primary query pattern
ConversionSnapshotSchema.index({ storeId: 1, scope: 1, entityId: 1, date: -1 }); // Entity-specific queries
ConversionSnapshotSchema.index({ date: 1 }); // Date range queries

// Unique constraint: one snapshot per day per scope per entity
ConversionSnapshotSchema.index(
  { storeId: 1, scope: 1, entityId: 1, date: 1 },
  { unique: true }
);

// Prevent updates and deletes (snapshots are immutable)
ConversionSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('ConversionSnapshot records are immutable and cannot be updated or deleted');
});

export const ConversionSnapshot: Model<IConversionSnapshot> =
  mongoose.models.ConversionSnapshot || mongoose.model<IConversionSnapshot>('ConversionSnapshot', ConversionSnapshotSchema);

