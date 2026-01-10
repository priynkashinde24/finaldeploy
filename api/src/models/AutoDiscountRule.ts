import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Auto Discount Rule Model
 * 
 * PURPOSE:
 * - Configurable rules for generating discount proposals from dead stock alerts
 * - Approval-based (no auto-application)
 * - Scope-specific (admin/supplier/reseller)
 * 
 * RULES:
 * - One active rule per scope per store
 * - Proposals require manual approval
 * - Never auto-apply discounts
 */

export interface IAutoDiscountRule extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;

  // Trigger conditions
  minDaysSinceLastSale: number; // Minimum days without sale to trigger
  minStockLevel: number; // Minimum stock level to trigger
  minStockValue: number; // Minimum stock value to trigger (optional)
  severityFilter?: ('warning' | 'critical')[]; // Only trigger for these severities

  // Discount calculation
  discountStrategy: 'fixed' | 'percentage' | 'tiered'; // How to calculate discount
  fixedDiscount?: number; // Fixed discount amount (for 'fixed' strategy)
  percentageDiscount?: number; // Percentage discount (for 'percentage' strategy)
  tieredDiscounts?: Array<{
    daysThreshold: number; // Days since last sale
    discountPercentage: number; // Discount % for this tier
  }>; // Tiered discounts (for 'tiered' strategy)
  maxDiscountPercent: number; // Maximum discount allowed (safety limit)
  minDiscountPercent: number; // Minimum discount (not worth it below this)

  // Approval settings
  requireApproval: boolean; // Always true (safety)
  approvalRoles: ('admin' | 'supplier' | 'reseller')[]; // Who can approve
  autoExpireDays: number; // Proposals expire after N days if not approved

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const AutoDiscountRuleSchema: Schema = new Schema(
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
    minDaysSinceLastSale: {
      type: Number,
      required: true,
      min: 0,
    },
    minStockLevel: {
      type: Number,
      required: true,
      min: 0,
    },
    minStockValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    severityFilter: {
      type: [String],
      enum: ['warning', 'critical'],
      default: ['warning', 'critical'],
    },
    discountStrategy: {
      type: String,
      enum: ['fixed', 'percentage', 'tiered'],
      required: true,
      default: 'tiered',
    },
    fixedDiscount: {
      type: Number,
      min: 0,
    },
    percentageDiscount: {
      type: Number,
      min: 0,
      max: 100,
    },
    tieredDiscounts: {
      type: [
        {
          daysThreshold: { type: Number, required: true, min: 0 },
          discountPercentage: { type: Number, required: true, min: 0, max: 100 },
        },
      ],
      default: [],
    },
    maxDiscountPercent: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
      max: 100,
    },
    minDiscountPercent: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
      max: 100,
    },
    requireApproval: {
      type: Boolean,
      required: true,
      default: true, // Always require approval
    },
    approvalRoles: {
      type: [String],
      enum: ['admin', 'supplier', 'reseller'],
      required: true,
      default: ['admin'],
    },
    autoExpireDays: {
      type: Number,
      required: true,
      default: 7,
      min: 1,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
AutoDiscountRuleSchema.index({ storeId: 1, scope: 1, isActive: 1 });
AutoDiscountRuleSchema.index({ storeId: 1, scope: 1, entityId: 1, isActive: 1 });

// Unique constraint: one active rule per scope per store
AutoDiscountRuleSchema.index(
  { storeId: 1, scope: 1, entityId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const AutoDiscountRule: Model<IAutoDiscountRule> =
  mongoose.models.AutoDiscountRule || mongoose.model<IAutoDiscountRule>('AutoDiscountRule', AutoDiscountRuleSchema);

