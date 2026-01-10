import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Dynamic Pricing Rule Model
 * 
 * PURPOSE:
 * - Automatically adjust selling price based on conditions
 * - Never violate Admin Pricing Rules
 * - Work with existing pricing + promotion system
 * - Fully controllable by Admin
 * 
 * TRIGGER TYPES:
 * - low_stock: Price increases when stock is below threshold
 * - high_demand: Price increases when order count exceeds threshold
 * - time_window: Price adjusts during specific time periods
 * 
 * RULES:
 * - Multiple rules allowed per scope
 * - Highest priority rule wins
 * - Disabled rules ignored
 * - One rule applied per variant (no stacking)
 */

export interface IDynamicPricingRule extends Document {
  scope: 'global' | 'category' | 'product' | 'variant';
  scopeId?: mongoose.Types.ObjectId | null; // null for global
  triggerType: 'low_stock' | 'high_demand' | 'time_window';
  conditions: {
    stockBelow?: number | null; // Trigger when stock < this value
    ordersAbove?: number | null; // Trigger when orders in period > this value
    startTime?: Date | null; // Time window start
    endTime?: Date | null; // Time window end
  };
  adjustmentType: 'increase' | 'decrease'; // Price adjustment direction
  adjustmentMode: 'percentage' | 'amount'; // How to calculate adjustment
  adjustmentValue: number; // Adjustment value (percentage or fixed amount)
  maxAdjustmentLimit?: number | null; // Maximum adjustment cap
  status: 'active' | 'inactive';
  priority: number; // Higher priority overrides lower (1-100, higher = more priority)
  createdBy: mongoose.Types.ObjectId; // Admin who created this rule
  createdAt: Date;
  updatedAt: Date;
}

const DynamicPricingRuleSchema: Schema = new Schema(
  {
    scope: {
      type: String,
      enum: ['global', 'category', 'product', 'variant'],
      required: [true, 'Scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    triggerType: {
      type: String,
      enum: ['low_stock', 'high_demand', 'time_window'],
      required: [true, 'Trigger type is required'],
      index: true,
    },
    conditions: {
      stockBelow: {
        type: Number,
        default: null,
        min: [0, 'Stock below must be non-negative'],
      },
      ordersAbove: {
        type: Number,
        default: null,
        min: [0, 'Orders above must be non-negative'],
      },
      startTime: {
        type: Date,
        default: null,
      },
      endTime: {
        type: Date,
        default: null,
      },
    },
    adjustmentType: {
      type: String,
      enum: ['increase', 'decrease'],
      required: [true, 'Adjustment type is required'],
    },
    adjustmentMode: {
      type: String,
      enum: ['percentage', 'amount'],
      required: [true, 'Adjustment mode is required'],
    },
    adjustmentValue: {
      type: Number,
      required: [true, 'Adjustment value is required'],
      min: [0, 'Adjustment value must be non-negative'],
      validate: {
        validator: function (this: IDynamicPricingRule, v: number) {
          if (this.adjustmentMode === 'percentage') {
            return v >= 0 && v <= 100; // Max 100% adjustment
          }
          return v >= 0;
        },
        message: 'Percentage adjustment must be between 0 and 100',
      },
    },
    maxAdjustmentLimit: {
      type: Number,
      default: null,
      min: [0, 'Maximum adjustment limit must be non-negative'],
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

// Compound indexes for common queries
DynamicPricingRuleSchema.index({ scope: 1, scopeId: 1, status: 1, priority: -1 });
DynamicPricingRuleSchema.index({ triggerType: 1, status: 1 });
DynamicPricingRuleSchema.index({ status: 1, priority: -1 });

// Pre-save hook: Validate scopeId based on scope
DynamicPricingRuleSchema.pre('save', function (next) {
  if (this.scope === 'global' && this.scopeId !== null) {
    return next(new Error('Global scope must have scopeId as null'));
  }
  if (this.scope !== 'global' && !this.scopeId) {
    return next(new Error(`${this.scope} scope must have a scopeId`));
  }

  // Validate conditions based on trigger type
  if (this.triggerType === 'low_stock' && this.conditions.stockBelow === null) {
    return next(new Error('Low stock trigger requires stockBelow condition'));
  }
  if (this.triggerType === 'high_demand' && this.conditions.ordersAbove === null) {
    return next(new Error('High demand trigger requires ordersAbove condition'));
  }
  if (this.triggerType === 'time_window') {
    if (this.conditions.startTime === null || this.conditions.endTime === null) {
      return next(new Error('Time window trigger requires startTime and endTime'));
    }
    if (this.conditions.startTime >= this.conditions.endTime) {
      return next(new Error('Start time must be before end time'));
    }
  }

  next();
});

export const DynamicPricingRule: Model<IDynamicPricingRule> =
  mongoose.models.DynamicPricingRule ||
  mongoose.model<IDynamicPricingRule>('DynamicPricingRule', DynamicPricingRuleSchema);

