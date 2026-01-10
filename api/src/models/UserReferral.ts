import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * User Referral Link Model
 *
 * PURPOSE:
 * - Link users to referral codes
 * - Track referrer relationship
 * - Store attribution at signup
 *
 * RULES:
 * - One referral link per user
 * - Immutable after creation
 */

export interface IUserReferral extends Document {
  userId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  referralCode: string; // Referral code used
  referrerId: mongoose.Types.ObjectId | string; // Who referred this user
  referrerType: 'customer' | 'reseller' | 'influencer';
  linkedAt: Date; // When user signed up with referral
  firstOrderId?: mongoose.Types.ObjectId | string; // First order ID (if converted)
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const UserReferralSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true, // One referral per user
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    referralCode: {
      type: String,
      required: [true, 'Referral code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    referrerId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Referrer ID is required'],
      index: true,
    },
    referrerType: {
      type: String,
      enum: ['customer', 'reseller', 'influencer'],
      required: [true, 'Referrer type is required'],
      index: true,
    },
    linkedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    firstOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
UserReferralSchema.index({ storeId: 1, referralCode: 1 });
UserReferralSchema.index({ referrerId: 1, referrerType: 1 });
UserReferralSchema.index({ storeId: 1, referrerId: 1, referrerType: 1 });

export const UserReferral: Model<IUserReferral> =
  mongoose.models.UserReferral || mongoose.model<IUserReferral>('UserReferral', UserReferralSchema);

