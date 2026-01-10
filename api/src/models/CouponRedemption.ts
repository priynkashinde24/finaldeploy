import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICouponRedemption extends Document {
  redemptionId: string;
  couponId: string;
  code: string;
  userId: string;
  orderId: string;
  discountAmount: number;
  createdAt: Date;
}

const CouponRedemptionSchema: Schema = new Schema(
  {
    redemptionId: {
      type: String,
      required: [true, 'Redemption ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    couponId: {
      type: String,
      required: [true, 'Coupon ID is required'],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      trim: true,
      index: true,
    },
    discountAmount: {
      type: Number,
      required: [true, 'Discount amount is required'],
      min: [0, 'Discount amount must be greater than or equal to 0'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
CouponRedemptionSchema.index({ couponId: 1, userId: 1 });
CouponRedemptionSchema.index({ userId: 1, orderId: 1 });

export const CouponRedemption: Model<ICouponRedemption> =
  mongoose.models.CouponRedemption ||
  mongoose.model<ICouponRedemption>('CouponRedemption', CouponRedemptionSchema);

