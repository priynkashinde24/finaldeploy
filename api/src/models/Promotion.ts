import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Promotion Model
 * 
 * PURPOSE:
 * - Auto-applied discounts (no coupon code needed)
 * - Applied automatically at checkout
 * - Only ONE promotion applied per item
 * - Lowest price wins (safe pricing)
 * 
 * RULES:
 * - Auto-applied (no coupon code)
 * - Only ONE promotion per item
 * - Must respect admin pricing rules
 * - Valid promotions are automatically applied
 */

export interface IPromotion extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  name: string; // Promotion name
  description?: string; // Optional description
  discountType: 'percentage' | 'amount'; // Discount calculation type
  discountValue: number; // Discount value (percentage or fixed amount)
  maxDiscountAmount?: number | null; // Maximum discount cap (for percentage discounts)
  applicableScope: 'category' | 'product' | 'variant'; // Where promotion applies (no global)
  scopeId: mongoose.Types.ObjectId; // Category/Product/Variant ID (required)
  validFrom: Date; // Promotion validity start date
  validTo: Date; // Promotion validity end date
  status: 'active' | 'inactive'; // Promotion status
  createdBy: mongoose.Types.ObjectId; // Admin who created this promotion
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Promotion name is required'],
      trim: true,
      maxlength: [200, 'Promotion name must not exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
    },
    discountType: {
      type: String,
      enum: ['percentage', 'amount'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value must be non-negative'],
      validate: {
        validator: function (this: IPromotion, v: number) {
          if (this.discountType === 'percentage') {
            return v >= 0 && v <= 100;
          }
          return v >= 0;
        },
        message: 'Percentage discount must be between 0 and 100, amount discount must be non-negative',
      },
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount amount must be non-negative'],
    },
    applicableScope: {
      type: String,
      enum: ['category', 'product', 'variant'],
      required: [true, 'Applicable scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Scope ID is required'],
      index: true,
      // Category ID for category scope
      // Product ID for product scope
      // Variant ID for variant scope
    },
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required'],
      index: true,
    },
    validTo: {
      type: Date,
      required: [true, 'Valid to date is required'],
      index: true,
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

// Compound indexes for common queries (storeId is primary filter)
PromotionSchema.index({ storeId: 1, applicableScope: 1, scopeId: 1, status: 1 });
PromotionSchema.index({ storeId: 1, status: 1, validFrom: 1, validTo: 1 });
PromotionSchema.index({ storeId: 1, createdBy: 1, status: 1 });

// Pre-save hook: Validate dates
PromotionSchema.pre('save', function (next) {
  if (this.validFrom >= this.validTo) {
    return next(new Error('Valid from date must be before valid to date'));
  }
  next();
});

// Method to check if promotion is valid
PromotionSchema.methods.isValid = function (): boolean {
  const now = new Date();
  return this.status === 'active' && now >= this.validFrom && now <= this.validTo;
};

export const Promotion: Model<IPromotion> =
  mongoose.models.Promotion || mongoose.model<IPromotion>('Promotion', PromotionSchema);

