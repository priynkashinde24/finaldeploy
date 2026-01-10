import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Pricing Rule Model
 * 
 * PURPOSE:
 * - Admin-defined pricing constraints
 * - Enforce minimum margins, price floors/ceilings, discount limits
 * - Prevent loss-making reseller pricing
 * - Control pricing system-wide
 * 
 * SCOPE HIERARCHY:
 * - Variant (most specific) → Product → Category → Global (fallback)
 * - More specific rules override less specific ones
 * 
 * RULES:
 * - One active rule per scope (scope + scopeId combination)
 * - Global rule acts as fallback when no specific rule exists
 * - Variant rule overrides product/category/global
 * - Inactive rules are ignored
 */

export interface IPricingRule extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  scope: 'product' | 'variant' | 'category' | 'global';
  scopeId?: mongoose.Types.ObjectId | null; // Product ID, Variant ID, Category ID, or null for global
  minMarginType: 'amount' | 'percentage'; // Minimum margin constraint type
  minMarginValue: number; // Minimum margin (₹ or %)
  maxDiscountPercentage?: number | null; // Maximum discount allowed (%)
  minSellingPrice?: number | null; // Minimum selling price floor
  maxSellingPrice?: number | null; // Maximum selling price ceiling
  enforceOn: ('reseller' | 'storefront')[]; // Where to enforce this rule
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId; // Admin who created this rule
  createdAt: Date;
  updatedAt: Date;
  // Legacy properties for backward compatibility (deprecated)
  type?: 'global' | 'override';
  sku?: string | null;
  markupPercent?: number;
}

const PricingRuleSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['product', 'variant', 'category', 'global'],
      required: [true, 'Scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
      // null for global scope
      // Product ID for product scope
      // Variant ID for variant scope
      // Category ID for category scope
    },
    minMarginType: {
      type: String,
      enum: ['amount', 'percentage'],
      required: [true, 'Minimum margin type is required'],
    },
    minMarginValue: {
      type: Number,
      required: [true, 'Minimum margin value is required'],
      min: [0, 'Minimum margin value must be non-negative'],
    },
    maxDiscountPercentage: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount percentage must be non-negative'],
      max: [100, 'Maximum discount percentage cannot exceed 100%'],
    },
    minSellingPrice: {
      type: Number,
      default: null,
      min: [0, 'Minimum selling price must be non-negative'],
    },
    maxSellingPrice: {
      type: Number,
      default: null,
      min: [0, 'Maximum selling price must be non-negative'],
    },
    enforceOn: {
      type: [String],
      enum: ['reseller', 'storefront'],
      required: [true, 'Enforce on is required'],
      validate: {
        validator: (arr: string[]) => arr.length > 0,
        message: 'At least one enforcement target is required',
      },
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

// Unique constraint: One active rule per store + scope + scopeId combination
PricingRuleSchema.index(
  { storeId: 1, scope: 1, scopeId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    // Only enforce uniqueness for active rules
  }
);

// Compound indexes for common queries (storeId is primary filter)
PricingRuleSchema.index({ storeId: 1, scope: 1, scopeId: 1 });
PricingRuleSchema.index({ storeId: 1, status: 1, scope: 1 });

// Pre-save hook: Validate scopeId based on scope
PricingRuleSchema.pre('save', function (next) {
  if (this.scope === 'global' && this.scopeId !== null) {
    return next(new Error('Global scope must have scopeId as null'));
  }
  if (this.scope !== 'global' && !this.scopeId) {
    return next(new Error(`${this.scope} scope must have a scopeId`));
  }
  next();
});

export const PricingRule: Model<IPricingRule> =
  mongoose.models.PricingRule || mongoose.model<IPricingRule>('PricingRule', PricingRuleSchema);
