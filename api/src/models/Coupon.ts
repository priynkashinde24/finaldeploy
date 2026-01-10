import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Coupon Model
 * 
 * PURPOSE:
 * - Admin-created discount coupons
 * - Applied at checkout with coupon code
 * - Never changes base prices (only applies at checkout)
 * - Fully auditable usage tracking
 * 
 * RULES:
 * - Code must be unique and uppercase
 * - Coupon applies only at checkout
 * - Must respect admin pricing rules (via discountEngine)
 * - Usage limits enforced per coupon and per user
 */

export interface ICouponConditions {
  minOrder?: number;
  productSkus?: string[];
  maxRedemptions?: number;
  usageLimitPerUser?: number;
}

export interface ICoupon extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  code: string; // Unique coupon code per store (uppercase)
  description?: string; // Optional description
  discountType: 'percentage' | 'amount'; // Discount calculation type
  discountValue: number; // Discount value (percentage or fixed amount)
  maxDiscountAmount?: number | null; // Maximum discount cap (for percentage discounts)
  minOrderValue?: number | null; // Minimum order value to apply coupon
  applicableScope: 'global' | 'category' | 'product' | 'variant'; // Where coupon applies
  scopeId?: mongoose.Types.ObjectId | null; // Category/Product/Variant ID (null for global)
  usageLimit?: number | null; // Total usage limit (null = unlimited)
  usagePerUser?: number | null; // Usage limit per user (null = unlimited)
  usedCount: number; // Current usage count
  validFrom: Date; // Coupon validity start date
  validTo: Date; // Coupon validity end date
  status: 'active' | 'inactive'; // Coupon status
  createdBy: mongoose.Types.ObjectId; // Admin who created this coupon
  createdAt: Date;
  updatedAt: Date;
  // Legacy properties for backward compatibility
  couponId?: string;
  type?: 'percent' | 'fixed' | 'bogo' | 'tiered';
  value?: number;
  active?: boolean;
  startsAt?: Date;
  endsAt?: Date;
  conditions?: ICouponConditions;
  // Methods
  isValid(): boolean;
  canBeUsedByUser(userEmail: string, orderValue: number): Promise<{ canUse: boolean; reason?: string }>;
}

const CouponSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      uppercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^[A-Z0-9]+$/.test(v),
        message: 'Coupon code must contain only uppercase letters and numbers',
      },
      // Unique per store (enforced via compound index)
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
        validator: function (this: ICoupon, v: number) {
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
    minOrderValue: {
      type: Number,
      default: null,
      min: [0, 'Minimum order value must be non-negative'],
    },
    applicableScope: {
      type: String,
      enum: ['global', 'category', 'product', 'variant'],
      required: [true, 'Applicable scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
      // null for global scope
      // Category ID for category scope
      // Product ID for product scope
      // Variant ID for variant scope
    },
    usageLimit: {
      type: Number,
      default: null,
      min: [1, 'Usage limit must be at least 1'],
    },
    usagePerUser: {
      type: Number,
      default: null,
      min: [1, 'Usage per user must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count must be non-negative'],
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
CouponSchema.index({ storeId: 1, code: 1 }, { unique: true }); // Unique code per store
CouponSchema.index({ storeId: 1, code: 1, status: 1 });
CouponSchema.index({ storeId: 1, applicableScope: 1, scopeId: 1, status: 1 });
CouponSchema.index({ storeId: 1, status: 1, validFrom: 1, validTo: 1 });
CouponSchema.index({ storeId: 1, createdBy: 1, status: 1 });

// Pre-save hook: Validate scopeId based on scope
CouponSchema.pre('save', function (next) {
  if (this.applicableScope === 'global' && this.scopeId !== null) {
    return next(new Error('Global scope must have scopeId as null'));
  }
  if (this.applicableScope !== 'global' && !this.scopeId) {
    return next(new Error(`${this.applicableScope} scope must have a scopeId`));
  }
  if (this.validFrom >= this.validTo) {
    return next(new Error('Valid from date must be before valid to date'));
  }
  next();
});

// Method to check if coupon is valid
CouponSchema.methods.isValid = function (): boolean {
  const now = new Date();
  return (
    this.status === 'active' &&
    now >= this.validFrom &&
    now <= this.validTo &&
    (this.usageLimit === null || this.usedCount < this.usageLimit)
  );
};

// Method to check if user can use coupon
CouponSchema.methods.canBeUsedByUser = async function (
  userEmail: string,
  orderValue: number
): Promise<{ canUse: boolean; reason?: string }> {
  // Check validity
  if (!this.isValid()) {
    return { canUse: false, reason: 'Coupon is not valid' };
  }

  // Check minimum order value
  if (this.minOrderValue !== null && orderValue < this.minOrderValue) {
    return {
      canUse: false,
      reason: `Minimum order value of ₹${this.minOrderValue} required`,
    };
  }

  // Check usage per user limit
  if (this.usagePerUser !== null) {
    const { CouponUsage } = await import('./CouponUsage');
    const userUsageCount = await CouponUsage.countDocuments({
      couponId: this._id,
      customerEmail: userEmail,
    });

    if (userUsageCount >= this.usagePerUser) {
      return {
        canUse: false,
        reason: `You have already used this coupon ${this.usagePerUser} time(s)`,
      };
    }
  }

  return { canUse: true };
};

export const Coupon: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);
