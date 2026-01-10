import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Referral Reward Model
 *
 * PURPOSE:
 * - Track referral rewards earned
 * - Link to orders and referrers
 * - Track payment status
 *
 * RULES:
 * - One reward per order per referrer
 * - Immutable after creation
 */

export interface IReferralReward extends Document {
  storeId: mongoose.Types.ObjectId;
  referrerId: mongoose.Types.ObjectId | string;
  referrerType: 'customer' | 'reseller' | 'influencer';
  referredUserId: mongoose.Types.ObjectId | string; // User who was referred
  orderId: mongoose.Types.ObjectId | string; // Order that triggered reward
  referralCode: string; // Referral code used
  amount: number; // Reward amount
  status: 'pending' | 'paid' | 'cancelled';
  rewardRuleId?: mongoose.Types.ObjectId; // Which rule was applied
  rewardSnapshot: {
    rewardType: 'flat' | 'percentage';
    rewardValue: number;
    trigger: 'signup' | 'first_order' | 'every_order';
    orderValue: number; // Order value at time of reward
  };
  ledgerEntryId?: mongoose.Types.ObjectId; // Link to payout ledger entry
  paidAt?: Date; // When reward was paid
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralRewardSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
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
    referredUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Referred user ID is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    referralCode: {
      type: String,
      required: [true, 'Referral code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Reward amount is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },
    rewardRuleId: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralRewardRule',
      default: null,
      index: true,
    },
    rewardSnapshot: {
      rewardType: {
        type: String,
        enum: ['flat', 'percentage'],
        required: true,
      },
      rewardValue: {
        type: Number,
        required: true,
      },
      trigger: {
        type: String,
        enum: ['signup', 'first_order', 'every_order'],
        required: true,
      },
      orderValue: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    ledgerEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'PayoutLedger',
      default: null,
      index: true,
    },
    paidAt: {
      type: Date,
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
ReferralRewardSchema.index({ storeId: 1, referrerId: 1, referrerType: 1, status: 1 });
ReferralRewardSchema.index({ orderId: 1, referrerId: 1 }, { unique: true }); // One reward per order per referrer
ReferralRewardSchema.index({ referralCode: 1, status: 1 });
ReferralRewardSchema.index({ storeId: 1, status: 1, createdAt: -1 });

export const ReferralReward: Model<IReferralReward> =
  mongoose.models.ReferralReward || mongoose.model<IReferralReward>('ReferralReward', ReferralRewardSchema);

