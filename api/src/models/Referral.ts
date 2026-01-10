import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReferralReward {
  type: 'credit' | 'discount' | 'points';
  value: number;
}

export interface IReferral extends Document {
  referralId: string;
  code: string;
  referrerUserId: string;
  referredEmail?: string;
  usedByUserId?: string;
  reward: IReferralReward;
  status: 'active' | 'used' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

const ReferralRewardSchema: Schema = new Schema(
  {
    type: {
      type: String,
      enum: ['credit', 'discount', 'points'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const ReferralSchema: Schema = new Schema(
  {
    referralId: {
      type: String,
      required: [true, 'Referral ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Referral code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    referrerUserId: {
      type: String,
      required: [true, 'Referrer user ID is required'],
      trim: true,
      index: true,
    },
    referredEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    usedByUserId: {
      type: String,
      trim: true,
      index: true,
    },
    reward: {
      type: ReferralRewardSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
ReferralSchema.index({ referrerUserId: 1, status: 1 });
ReferralSchema.index({ code: 1, status: 1 });

export const Referral: Model<IReferral> =
  mongoose.models.Referral || mongoose.model<IReferral>('Referral', ReferralSchema);

