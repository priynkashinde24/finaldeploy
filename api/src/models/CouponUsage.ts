import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Coupon Usage Model
 * 
 * PURPOSE:
 * - Audit trail for coupon usage
 * - Track which coupons were used on which orders
 * - Prevent abuse and track discount costs
 * 
 * RULES:
 * - One record per coupon usage
 * - Immutable (never deleted)
 * - Links coupon to order
 */

export interface ICouponUsage extends Document {
  couponId: mongoose.Types.ObjectId; // Reference to Coupon
  orderId: string; // Reference to Order
  customerEmail?: string; // Customer email (for per-user limits)
  discountAmount: number; // Actual discount applied
  usedAt: Date; // When coupon was used
  createdAt: Date;
}

const CouponUsageSchema: Schema = new Schema(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: [true, 'Coupon ID is required'],
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      index: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    discountAmount: {
      type: Number,
      required: [true, 'Discount amount is required'],
      min: [0, 'Discount amount must be non-negative'],
    },
    usedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
CouponUsageSchema.index({ couponId: 1, customerEmail: 1 });
CouponUsageSchema.index({ orderId: 1 });
CouponUsageSchema.index({ usedAt: 1 });

// Prevent duplicate usage (same coupon on same order)
CouponUsageSchema.index({ couponId: 1, orderId: 1 }, { unique: true });

export const CouponUsage: Model<ICouponUsage> =
  mongoose.models.CouponUsage || mongoose.model<ICouponUsage>('CouponUsage', CouponUsageSchema);

