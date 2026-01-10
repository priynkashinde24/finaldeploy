import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Return Shipping Rule Model
 *
 * PURPOSE:
 * - Define who pays return shipping costs
 * - Support SKU-level, category-level, and global rules
 * - Apply rules based on return reason and condition
 * - Prevent margin leakage
 *
 * RULES:
 * - SKU > Category > Global precedence
 * - Highest priority match wins
 * - One effective rule per RMA item
 * - Snapshot frozen at RMA approval
 */

export interface IReturnShippingRule extends Document {
  storeId: mongoose.Types.ObjectId;
  scope: 'sku' | 'category' | 'global';
  skuId?: mongoose.Types.ObjectId | string; // Required if scope = 'sku'
  categoryId?: mongoose.Types.ObjectId | string; // Required if scope = 'category'
  returnReason: string[]; // e.g. ['damaged', 'wrong_item', 'no_longer_needed']
  condition: ('sealed' | 'opened' | 'damaged')[]; // Item conditions this rule applies to
  payer: 'customer' | 'supplier' | 'reseller' | 'platform';
  chargeType: 'flat' | 'percentage' | 'actual_shipping';
  chargeValue: number; // Amount (for flat) or percentage (for percentage)
  isActive: boolean;
  priority: number; // Lower number = higher priority
  description?: string; // Optional description
  createdAt: Date;
  updatedAt: Date;
}

const ReturnShippingRuleSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['sku', 'category', 'global'],
      required: [true, 'Scope is required'],
      index: true,
    },
    skuId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    returnReason: {
      type: [String],
      required: [true, 'Return reason is required'],
      default: [],
    },
    condition: {
      type: [String],
      enum: ['sealed', 'opened', 'damaged'],
      required: [true, 'Condition is required'],
      default: [],
    },
    payer: {
      type: String,
      enum: ['customer', 'supplier', 'reseller', 'platform'],
      required: [true, 'Payer is required'],
    },
    chargeType: {
      type: String,
      enum: ['flat', 'percentage', 'actual_shipping'],
      required: [true, 'Charge type is required'],
    },
    chargeValue: {
      type: Number,
      required: [true, 'Charge value is required'],
      min: [0, 'Charge value must be non-negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      required: [true, 'Priority is required'],
      default: 999,
      min: [1, 'Priority must be at least 1'],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for rule resolution
ReturnShippingRuleSchema.index({ storeId: 1, scope: 1, isActive: 1 });
ReturnShippingRuleSchema.index({ storeId: 1, skuId: 1, isActive: 1 });
ReturnShippingRuleSchema.index({ storeId: 1, categoryId: 1, isActive: 1 });
ReturnShippingRuleSchema.index({ storeId: 1, scope: 1, priority: 1 });

// Validation: Ensure skuId is set when scope = 'sku'
ReturnShippingRuleSchema.pre('validate', function (next) {
  if (this.scope === 'sku' && !this.skuId) {
    return next(new Error('skuId is required when scope is "sku"'));
  }
  if (this.scope === 'category' && !this.categoryId) {
    return next(new Error('categoryId is required when scope is "category"'));
  }
  if (this.scope === 'global' && (this.skuId || this.categoryId)) {
    return next(new Error('skuId and categoryId must be null when scope is "global"'));
  }
  next();
});

export const ReturnShippingRule: Model<IReturnShippingRule> =
  mongoose.models.ReturnShippingRule ||
  mongoose.model<IReturnShippingRule>('ReturnShippingRule', ReturnShippingRuleSchema);

