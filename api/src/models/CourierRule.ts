import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Courier Mapping Rule Model
 * 
 * PURPOSE:
 * - Define rules for courier assignment
 * - Support zone, payment method, weight, order value filters
 * - Priority-based rule matching
 * 
 * RULES:
 * - Multiple rules allowed per zone
 * - Highest priority matching rule wins
 * - No overlapping rules with same priority
 */

export interface ICourierRule extends Document {
  storeId: mongoose.Types.ObjectId;
  zoneId: mongoose.Types.ObjectId;
  paymentMethod: 'prepaid' | 'cod' | 'both'; // Payment methods this rule applies to
  minWeight?: number; // Optional: minimum weight in kg
  maxWeight?: number; // Optional: maximum weight in kg (0 = no limit)
  minOrderValue?: number; // Optional: minimum order value
  maxOrderValue?: number; // Optional: maximum order value (0 = no limit)
  courierId: mongoose.Types.ObjectId;
  priority: number; // Lower = higher priority (1 = highest)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourierRuleSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: 'ShippingZone',
      required: [true, 'Zone ID is required'],
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['prepaid', 'cod', 'both'],
      required: [true, 'Payment method is required'],
      index: true,
    },
    minWeight: {
      type: Number,
      min: [0, 'Min weight must be non-negative'],
      default: null,
    },
    maxWeight: {
      type: Number,
      min: [0, 'Max weight must be non-negative'],
      default: null,
      validate: {
        validator: function (this: ICourierRule, value: number | null) {
          if (value === null || this.minWeight === null || this.minWeight === undefined) return true;
          return value > this.minWeight;
        },
        message: 'Max weight must be greater than min weight',
      },
    },
    minOrderValue: {
      type: Number,
      min: [0, 'Min order value must be non-negative'],
      default: null,
    },
    maxOrderValue: {
      type: Number,
      min: [0, 'Max order value must be non-negative'],
      default: null,
      validate: {
        validator: function (this: ICourierRule, value: number | null) {
          if (value === null || this.minOrderValue === null || this.minOrderValue === undefined) return true;
          return value > this.minOrderValue;
        },
        message: 'Max order value must be greater than min order value',
      },
    },
    courierId: {
      type: Schema.Types.ObjectId,
      ref: 'Courier',
      required: [true, 'Courier ID is required'],
      index: true,
    },
    priority: {
      type: Number,
      required: [true, 'Priority is required'],
      min: [1, 'Priority must be at least 1'],
      default: 999, // Lower = higher priority
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient rule matching
CourierRuleSchema.index({ storeId: 1, zoneId: 1, isActive: 1, priority: 1 });
CourierRuleSchema.index({ storeId: 1, zoneId: 1, paymentMethod: 1, isActive: 1 });
CourierRuleSchema.index({ courierId: 1, isActive: 1 });

export const CourierRule: Model<ICourierRule> =
  mongoose.models.CourierRule || mongoose.model<ICourierRule>('CourierRule', CourierRuleSchema);

