import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Referral Reward Rule Model
 *
 * PURPOSE:
 * - Define reward rules for referrals
 * - Support different reward types and triggers
 * - Store-level configuration
 *
 * RULES:
 * - One active rule per store per referrerType per trigger
 * - Rules applied in priority order
 */

export interface IReferralRewardRule extends Document {
  storeId: mongoose.Types.ObjectId;
  referrerType: 'customer' | 'reseller';
  rewardType: 'flat' | 'percentage';
  rewardValue: number; // Flat amount or percentage (0-100)
  trigger: 'signup' | 'first_order' | 'every_order';
  maxRewardPerUser?: number; // Nullable: no limit if null
  maxRewardPerOrder?: number; // Nullable: no limit if null
  minOrderValue?: number; // Minimum order value to qualify
  isActive: boolean;
  priority: number; // Lower number = higher priority
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralRewardRuleSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    referrerType: {
      type: String,
      enum: ['customer', 'reseller'],
      required: [true, 'Referrer type is required'],
      index: true,
    },
    rewardType: {
      type: String,
      enum: ['flat', 'percentage'],
      required: [true, 'Reward type is required'],
    },
    rewardValue: {
      type: Number,
      required: [true, 'Reward value is required'],
      min: 0,
    },
    trigger: {
      type: String,
      enum: ['signup', 'first_order', 'every_order'],
      required: [true, 'Trigger is required'],
      index: true,
    },
    maxRewardPerUser: {
      type: Number,
      min: 0,
      default: null,
    },
    maxRewardPerOrder: {
      type: Number,
      min: 0,
      default: null,
    },
    minOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 999,
      min: 1,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
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
ReferralRewardRuleSchema.index({ storeId: 1, referrerType: 1, trigger: 1, isActive: 1, priority: 1 });
ReferralRewardRuleSchema.index({ storeId: 1, isActive: 1, priority: 1 });

// Validation
ReferralRewardRuleSchema.pre('save', function (next) {
  // Validate percentage range
  if (this.rewardType === 'percentage' && (this.rewardValue < 0 || this.rewardValue > 100)) {
    return next(new Error('Percentage reward value must be between 0 and 100'));
  }

  next();
});

export const ReferralRewardRule: Model<IReferralRewardRule> =
  mongoose.models.ReferralRewardRule ||
  mongoose.model<IReferralRewardRule>('ReferralRewardRule', ReferralRewardRuleSchema);

