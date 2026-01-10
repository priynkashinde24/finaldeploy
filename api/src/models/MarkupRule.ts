import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Markup Rule Model
 * 
 * PURPOSE:
 * - Admin-defined markup constraints to control minimum & maximum markups
 * - Applies to reseller pricing, promotions, AI suggestions, checkout
 * - Prevents margin abuse or loss
 * - Fully auditable and override-safe
 * 
 * SCOPE HIERARCHY:
 * - Variant (most specific) → Product → Brand → Category → Global (fallback)
 * - More specific rules override less specific ones
 * - Multiple rules allowed per scope (unlike PricingRule)
 * - Highest priority wins when multiple rules exist
 * - Brand rules override category & global rules
 * - Region + brand rules combine with priority
 * 
 * RULES:
 * - Markup rules define allowed price window, not final price
 * - Rules never auto-change prices, only enforce on save & checkout
 * - Disable = instant effect
 * - Immutable historical orders
 */

export interface IMarkupRule extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  scope: 'global' | 'category' | 'brand' | 'product' | 'variant';
  scopeId?: mongoose.Types.ObjectId | null; // Category ID, Brand ID, Product ID, Variant ID, or null for global
  brandId?: mongoose.Types.ObjectId | null; // Brand ID (for brand scope or region+brand combinations)
  regionId?: mongoose.Types.ObjectId | string | null; // Region ID (optional, for region-specific rules)
  minMarkupType: 'amount' | 'percentage'; // Minimum markup constraint type
  minMarkupValue: number; // Minimum markup (₹ or %)
  maxMarkupType?: 'amount' | 'percentage' | null; // Maximum markup constraint type (optional)
  maxMarkupValue?: number | null; // Maximum markup (₹ or %)
  appliesTo: ('reseller' | 'store')[]; // Where to enforce this rule
  status: 'active' | 'inactive';
  priority: number; // Higher priority overrides lower (1-100, higher = more priority)
  createdBy: mongoose.Types.ObjectId; // Admin who created this rule
  createdAt: Date;
  updatedAt: Date;
}

const MarkupRuleSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['global', 'category', 'brand', 'product', 'variant'],
      required: [true, 'Scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
      // null for global scope
      // Category ID for category scope
      // Brand ID for brand scope
      // Product ID for product scope
      // Variant ID for variant scope
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      default: null,
      index: true,
      // Brand ID for brand-level markup policies
      // Used when scope is 'brand' or for region+brand combinations
    },
    regionId: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
      default: null,
      index: true,
      // Region ID for region-specific markup rules
      // When combined with brand, creates region+brand rule
    },
    minMarkupType: {
      type: String,
      enum: ['amount', 'percentage'],
      required: [true, 'Minimum markup type is required'],
    },
    minMarkupValue: {
      type: Number,
      required: [true, 'Minimum markup value is required'],
      min: [0, 'Minimum markup value must be non-negative'],
    },
    maxMarkupType: {
      type: String,
      enum: ['amount', 'percentage'],
      default: null,
    },
    maxMarkupValue: {
      type: Number,
      default: null,
      min: [0, 'Maximum markup value must be non-negative'],
    },
    appliesTo: {
      type: [String],
      enum: ['reseller', 'store'],
      required: [true, 'Applies to is required'],
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
    priority: {
      type: Number,
      required: [true, 'Priority is required'],
      min: [1, 'Priority must be at least 1'],
      max: [100, 'Priority must not exceed 100'],
      default: 50,
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

// Compound indexes for common queries (storeId is primary filter)
MarkupRuleSchema.index({ storeId: 1, scope: 1, scopeId: 1, status: 1 });
MarkupRuleSchema.index({ storeId: 1, brandId: 1, status: 1 }); // For brand-level queries
MarkupRuleSchema.index({ storeId: 1, regionId: 1, brandId: 1, status: 1 }); // For region+brand combinations
MarkupRuleSchema.index({ storeId: 1, status: 1, priority: -1 }); // For priority-based resolution
MarkupRuleSchema.index({ storeId: 1, appliesTo: 1, status: 1 });

// Pre-save hook: Validate scopeId and brandId based on scope
MarkupRuleSchema.pre('save', function (next) {
  if (this.scope === 'global' && this.scopeId !== null) {
    return next(new Error('Global scope must have scopeId as null'));
  }
  if (this.scope !== 'global' && !this.scopeId) {
    return next(new Error(`${this.scope} scope must have a scopeId`));
  }
  
  // For brand scope, brandId should match scopeId
  if (this.scope === 'brand') {
    if (!this.brandId || this.brandId.toString() !== this.scopeId?.toString()) {
      // Auto-set brandId from scopeId if not set
      if (this.scopeId) {
        this.brandId = this.scopeId;
      } else {
        return next(new Error('Brand scope must have a brandId'));
      }
    }
  }
  
  // Validate max markup if provided
  if (this.maxMarkupType && this.maxMarkupValue !== null && this.maxMarkupValue !== undefined) {
    // If both min and max are percentages, ensure max >= min
    if (this.minMarkupType === 'percentage' && this.maxMarkupType === 'percentage') {
      if (this.maxMarkupValue < this.minMarkupValue) {
        return next(new Error('Maximum markup must be greater than or equal to minimum markup'));
      }
    }
  }
  
  next();
});

export const MarkupRule: Model<IMarkupRule> =
  mongoose.models.MarkupRule || mongoose.model<IMarkupRule>('MarkupRule', MarkupRuleSchema);

