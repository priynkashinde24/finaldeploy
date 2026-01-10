import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Dead Stock Alert Model
 * 
 * PURPOSE:
 * - Track dead stock alerts for SKUs
 * - Stateful alerts (not re-created daily)
 * - One open alert per SKU per scope
 * 
 * RULES:
 * - One open alert per SKU per scope
 * - Alerts are snapshot-based (immutable snapshot at creation)
 * - Can be acknowledged or resolved
 * - Resolution creates new state (doesn't update snapshot)
 */

export type DeadStockAlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface IDeadStockAlert extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;
  skuId: mongoose.Types.ObjectId;
  sku: string;
  productId: mongoose.Types.ObjectId;

  // Alert details
  severity: 'warning' | 'critical';
  status: DeadStockAlertStatus;

  // Snapshot at alert creation (immutable)
  stockLevel: number; // Stock level when alert was created
  stockValue: number; // Stock value (stockLevel * costPrice)
  lastSoldAt: Date | null; // Last sale date (from order history)
  daysSinceLastSale: number; // Days since last sale
  daysSinceFirstStock?: number; // Days since first stock entry
  salesVelocity?: number; // Sales velocity (units per day)

  // Rule that triggered this alert
  ruleId: mongoose.Types.ObjectId; // Reference to DeadStockRule

  // Action suggestions (read-only, advisory)
  suggestions: {
    discountPercent?: number; // Suggested discount %
    bundleWith?: mongoose.Types.ObjectId[]; // Suggested bundle SKUs
    liquidation?: boolean; // Suggest liquidation
    supplierReturn?: boolean; // Suggest return to supplier (if allowed)
    delist?: boolean; // Suggest delisting
  };

  // Resolution tracking
  internalNote?: string; // Internal note added by user
  acknowledgedAt?: Date;
  acknowledgedBy?: mongoose.Types.ObjectId | string;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId | string;
  resolutionReason?: string; // Why alert was resolved

  createdAt: Date;
  updatedAt: Date;
}

const DeadStockAlertSchema: Schema = new Schema(
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
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved'],
      required: true,
      default: 'open',
      index: true,
    },
    stockLevel: {
      type: Number,
      required: true,
      min: 0,
    },
    stockValue: {
      type: Number,
      required: true,
      min: 0,
    },
    lastSoldAt: {
      type: Date,
      default: null,
    },
    daysSinceLastSale: {
      type: Number,
      required: true,
      min: 0,
    },
    daysSinceFirstStock: {
      type: Number,
      min: 0,
    },
    salesVelocity: {
      type: Number,
      min: 0,
    },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'DeadStockRule',
      required: [true, 'Rule ID is required'],
      index: true,
    },
    suggestions: {
      discountPercent: { type: Number, min: 0, max: 100 },
      bundleWith: [{ type: Schema.Types.ObjectId, ref: 'ProductVariant' }],
      liquidation: { type: Boolean, default: false },
      supplierReturn: { type: Boolean, default: false },
      delist: { type: Boolean, default: false },
    },
    internalNote: {
      type: String,
      trim: true,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: Schema.Types.Mixed,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.Mixed,
    },
    resolutionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
DeadStockAlertSchema.index({ storeId: 1, scope: 1, status: 1, severity: -1 });
DeadStockAlertSchema.index({ storeId: 1, scope: 1, entityId: 1, status: 1 });
DeadStockAlertSchema.index({ skuId: 1, scope: 1, status: 1 });
DeadStockAlertSchema.index({ severity: 1, status: 1, createdAt: -1 });

// Unique constraint: one open alert per SKU per scope
DeadStockAlertSchema.index(
  { storeId: 1, scope: 1, entityId: 1, skuId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'acknowledged'] } } }
);

export const DeadStockAlert: Model<IDeadStockAlert> =
  mongoose.models.DeadStockAlert || mongoose.model<IDeadStockAlert>('DeadStockAlert', DeadStockAlertSchema);

