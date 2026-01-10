import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Shipping Rate Model
 * 
 * PURPOSE:
 * - Store shipping rates per zone
 * - Support weight-based and order-value-based rates
 * - Define rate slabs (non-overlapping)
 * - Handle COD surcharges
 * 
 * RULES:
 * - Non-overlapping slabs per zone per rateType
 * - Inclusive min, exclusive max
 * - One matching slab per request
 * - Store-specific rates
 */

export interface IShippingRate extends Document {
  storeId: mongoose.Types.ObjectId;
  zoneId: mongoose.Types.ObjectId;
  rateType: 'weight' | 'order_value'; // Weight in kg or order value in currency
  minValue: number; // Inclusive minimum (kg or ₹)
  maxValue: number; // Exclusive maximum (kg or ₹)
  baseRate: number; // Base shipping rate
  perUnitRate: number; // Per kg or per ₹ (for variable component)
  codSurcharge: number; // Additional charge for COD orders
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShippingRateSchema: Schema = new Schema(
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
    rateType: {
      type: String,
      enum: ['weight', 'order_value'],
      required: [true, 'Rate type is required'],
      index: true,
    },
    minValue: {
      type: Number,
      required: [true, 'Minimum value is required'],
      min: [0, 'Minimum value must be non-negative'],
    },
    maxValue: {
      type: Number,
      required: [true, 'Maximum value is required'],
      min: [0, 'Maximum value must be non-negative'],
      validate: {
        validator: function (this: IShippingRate, value: number) {
          return value > this.minValue;
        },
        message: 'Maximum value must be greater than minimum value',
      },
    },
    baseRate: {
      type: Number,
      required: [true, 'Base rate is required'],
      min: [0, 'Base rate must be non-negative'],
    },
    perUnitRate: {
      type: Number,
      required: [true, 'Per unit rate is required'],
      min: [0, 'Per unit rate must be non-negative'],
      default: 0,
    },
    codSurcharge: {
      type: Number,
      required: [true, 'COD surcharge is required'],
      min: [0, 'COD surcharge must be non-negative'],
      default: 0,
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

// Validate non-overlapping slabs per zone per rateType
ShippingRateSchema.pre('save', async function (next) {
  const rate = this as IShippingRate;

  // Check for overlapping slabs
  const overlappingRate = await ShippingRate.findOne({
    _id: { $ne: rate._id },
    storeId: rate.storeId,
    zoneId: rate.zoneId,
    rateType: rate.rateType,
    isActive: true,
    $or: [
      // New slab starts within existing slab
      { minValue: { $lte: rate.minValue }, maxValue: { $gt: rate.minValue } },
      // New slab ends within existing slab
      { minValue: { $lt: rate.maxValue }, maxValue: { $gte: rate.maxValue } },
      // New slab completely contains existing slab
      { minValue: { $gte: rate.minValue }, maxValue: { $lte: rate.maxValue } },
    ],
  });

  if (overlappingRate) {
    return next(
      new Error(
        `Overlapping slab found: ${overlappingRate.minValue}-${overlappingRate.maxValue} for zone ${rate.zoneId}`
      )
    );
  }

  next();
});

// Compound indexes for efficient queries
ShippingRateSchema.index({ storeId: 1, zoneId: 1, rateType: 1, isActive: 1 });
ShippingRateSchema.index({ zoneId: 1, rateType: 1, minValue: 1, maxValue: 1 });

export const ShippingRate: Model<IShippingRate> =
  mongoose.models.ShippingRate || mongoose.model<IShippingRate>('ShippingRate', ShippingRateSchema);

