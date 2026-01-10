import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Store Price Override Model
 * 
 * PURPOSE:
 * - Allow store-specific price overrides
 * - Support product, variant, or category-level overrides
 * - Fixed price or price delta adjustments
 * - Respect admin pricing rules (min/max validation)
 * 
 * RULES:
 * - One active override per store + scope combination
 * - Variant overrides have highest priority
 * - Overrides never bypass admin pricing rules
 * - Disabling override = instant fallback to default pricing
 */

export interface IStorePriceOverride extends Document {
  storeId: mongoose.Types.ObjectId; // Reference to Store
  scope: 'product' | 'variant' | 'category'; // What this override applies to
  scopeId: mongoose.Types.ObjectId; // Product ID, Variant ID, or Category ID
  overrideType: 'fixed_price' | 'price_delta'; // Fixed price or delta adjustment
  overrideValue: number; // Fixed price amount OR delta percentage/amount
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId; // Admin or reseller who created this
  createdAt: Date;
  updatedAt: Date;
}

const StorePriceOverrideSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['product', 'variant', 'category'],
      required: [true, 'Scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Scope ID is required'],
      index: true,
      // Can reference Product, ProductVariant, or Category
    },
    overrideType: {
      type: String,
      enum: ['fixed_price', 'price_delta'],
      required: [true, 'Override type is required'],
    },
    overrideValue: {
      type: Number,
      required: [true, 'Override value is required'],
      // For fixed_price: absolute price
      // For price_delta: percentage (e.g., 10 for +10%) or absolute amount
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
// Ensure one active override per store + scope combination
StorePriceOverrideSchema.index(
  { storeId: 1, scope: 1, scopeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

// Index for resolving overrides by priority
StorePriceOverrideSchema.index({ storeId: 1, scope: 1, status: 1 });
StorePriceOverrideSchema.index({ storeId: 1, scopeId: 1, status: 1 });

export const StorePriceOverride: Model<IStorePriceOverride> =
  mongoose.models.StorePriceOverride ||
  mongoose.model<IStorePriceOverride>('StorePriceOverride', StorePriceOverrideSchema);

