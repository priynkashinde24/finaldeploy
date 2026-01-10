import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Price Sensitivity Snapshot Model
 * 
 * PURPOSE:
 * - Track price changes and demand correlation
 * - Calculate price elasticity of demand
 * - One snapshot per SKU per price change event
 * - Used for price optimization recommendations
 * 
 * RULES:
 * - One snapshot per SKU per price change per scope
 * - Tracks price before/after and demand before/after
 * - Never update historical snapshots
 */

export interface IPriceSensitivitySnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;
  skuId: mongoose.Types.ObjectId;
  sku: string;
  productId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format

  // Price metrics
  priceBefore: number;
  priceAfter: number;
  priceChangePercent: number; // ((priceAfter - priceBefore) / priceBefore) * 100

  // Demand metrics (before price change - last 7 days)
  demandBefore: {
    views: number;
    addToCart: number;
    ordersCount: number;
    quantitySold: number;
    revenue: number;
  };

  // Demand metrics (after price change - next 7 days)
  demandAfter: {
    views: number;
    addToCart: number;
    ordersCount: number;
    quantitySold: number;
    revenue: number;
  };

  // Elasticity calculations
  priceElasticity: number; // % change in quantity / % change in price
  revenueImpact: number; // revenueAfter - revenueBefore
  demandChangePercent: number; // ((quantityAfter - quantityBefore) / quantityBefore) * 100

  // Classification
  sensitivity: 'elastic' | 'inelastic' | 'unitary'; // |elasticity| > 1, < 1, = 1
  recommendation: 'increase' | 'decrease' | 'maintain';

  createdAt: Date;
  updatedAt: Date;
}

const PriceSensitivitySnapshotSchema: Schema = new Schema(
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
    priceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    priceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    priceChangePercent: {
      type: Number,
      required: true,
    },
    demandBefore: {
      views: { type: Number, default: 0 },
      addToCart: { type: Number, default: 0 },
      ordersCount: { type: Number, default: 0 },
      quantitySold: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
    },
    demandAfter: {
      views: { type: Number, default: 0 },
      addToCart: { type: Number, default: 0 },
      ordersCount: { type: Number, default: 0 },
      quantitySold: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
    },
    priceElasticity: {
      type: Number,
      required: true,
    },
    revenueImpact: {
      type: Number,
      required: true,
    },
    demandChangePercent: {
      type: Number,
      required: true,
    },
    sensitivity: {
      type: String,
      enum: ['elastic', 'inelastic', 'unitary'],
      required: true,
      index: true,
    },
    recommendation: {
      type: String,
      enum: ['increase', 'decrease', 'maintain'],
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
PriceSensitivitySnapshotSchema.index({ storeId: 1, scope: 1, skuId: 1, date: -1 });
PriceSensitivitySnapshotSchema.index({ skuId: 1, date: -1 });
PriceSensitivitySnapshotSchema.index({ sensitivity: 1, recommendation: 1, date: -1 });

// Prevent updates and deletes
PriceSensitivitySnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('PriceSensitivitySnapshot records are immutable and cannot be updated or deleted');
});

export const PriceSensitivitySnapshot: Model<IPriceSensitivitySnapshot> =
  mongoose.models.PriceSensitivitySnapshot || mongoose.model<IPriceSensitivitySnapshot>('PriceSensitivitySnapshot', PriceSensitivitySnapshotSchema);

