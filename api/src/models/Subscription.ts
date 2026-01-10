import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Subscription Model
 * 
 * PURPOSE:
 * - Track user subscriptions to plans
 * - Monitor usage against plan limits
 * - Handle trial periods
 * - Track billing cycles
 * 
 * RULES:
 * - One active subscription per user
 * - Trial allowed once per user
 * - Usage resets monthly
 * - Subscription status controls access
 */

export interface ISubscription extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  userId: mongoose.Types.ObjectId; // User (reseller or supplier)
  role: 'reseller' | 'supplier'; // User's role
  planId: mongoose.Types.ObjectId; // Reference to Plan
  billingCycle: 'monthly' | 'yearly';
  startDate: Date; // Subscription start date
  endDate: Date; // Subscription end date
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  usage: {
    productsUsed: number; // Current number of products
    variantsUsed: number; // Current number of variants
    ordersThisMonth: number; // Orders in current billing period
    lastResetDate: Date; // When usage was last reset
  };
  trialEndDate?: Date; // When trial ends (if status is trial)
  cancelledAt?: Date; // When subscription was cancelled
  cancelledBy?: mongoose.Types.ObjectId; // Who cancelled (admin or user)
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    role: {
      type: String,
      enum: ['reseller', 'supplier'],
      required: [true, 'Role is required'],
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan ID is required'],
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: [true, 'Billing cycle is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['trial', 'active', 'past_due', 'cancelled', 'expired'],
      default: 'trial',
      index: true,
    },
    usage: {
      productsUsed: {
        type: Number,
        default: 0,
        min: [0, 'Products used must be non-negative'],
      },
      variantsUsed: {
        type: Number,
        default: 0,
        min: [0, 'Variants used must be non-negative'],
      },
      ordersThisMonth: {
        type: Number,
        default: 0,
        min: [0, 'Orders this month must be non-negative'],
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
    },
    trialEndDate: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One active subscription per user per store
SubscriptionSchema.index(
  { storeId: 1, userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['trial', 'active', 'past_due'] } },
  }
);

// Compound indexes for common queries (storeId is primary filter)
SubscriptionSchema.index({ storeId: 1, role: 1, status: 1 });
SubscriptionSchema.index({ storeId: 1, planId: 1, status: 1 });
SubscriptionSchema.index({ storeId: 1, endDate: 1, status: 1 }); // For finding expiring subscriptions

// Pre-save hook: Auto-update status based on dates
SubscriptionSchema.pre('save', function (next) {
  const now = new Date();

  // If trial and trial ended, mark as expired
  if (this.status === 'trial' && this.trialEndDate && now > this.trialEndDate) {
    this.status = 'expired';
  }

  // If active and end date passed, mark as expired
  if (this.status === 'active' && now > this.endDate) {
    this.status = 'expired';
  }

  // Reset usage if new month
  if (this.usage.lastResetDate) {
    const lastReset = new Date(this.usage.lastResetDate);
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();
    const lastResetMonth = lastReset.getMonth();
    const lastResetYear = lastReset.getFullYear();

    if (nowMonth !== lastResetMonth || nowYear !== lastResetYear) {
      this.usage.ordersThisMonth = 0;
      this.usage.lastResetDate = now;
    }
  }

  next();
});

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription || mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

