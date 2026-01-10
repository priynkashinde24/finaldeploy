import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Stripe Connect Account Model
 * 
 * PURPOSE:
 * - Link suppliers to Stripe Connect accounts
 * - Enable direct payouts to suppliers
 * - Track account status and onboarding
 * 
 * RULES:
 * - One Connect account per supplier
 * - Account must be onboarded before payouts
 */

export interface IStripeConnectAccount extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  supplierId: mongoose.Types.ObjectId; // Supplier user ID
  stripeAccountId: string; // Stripe Connect account ID (acct_xxx)
  accountStatus: 'pending' | 'restricted' | 'enabled' | 'disabled'; // Stripe account status
  onboardingStatus: 'incomplete' | 'complete'; // Onboarding completion status
  onboardingLink?: string; // Latest onboarding link
  payoutsEnabled: boolean; // Whether payouts are enabled
  chargesEnabled: boolean; // Whether charges are enabled
  detailsSubmitted: boolean; // Whether account details have been submitted
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const StripeConnectAccountSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      unique: true,
      index: true,
    },
    stripeAccountId: {
      type: String,
      required: [true, 'Stripe account ID is required'],
      unique: true,
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ['pending', 'restricted', 'enabled', 'disabled'],
      default: 'pending',
      index: true,
    },
    onboardingStatus: {
      type: String,
      enum: ['incomplete', 'complete'],
      default: 'incomplete',
      index: true,
    },
    onboardingLink: {
      type: String,
      default: null,
    },
    payoutsEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    chargesEnabled: {
      type: Boolean,
      default: false,
    },
    detailsSubmitted: {
      type: Boolean,
      default: false,
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

// Unique constraint: One Connect account per supplier
StripeConnectAccountSchema.index({ storeId: 1, supplierId: 1 }, { unique: true });

export const StripeConnectAccount: Model<IStripeConnectAccount> = mongoose.model<IStripeConnectAccount>(
  'StripeConnectAccount',
  StripeConnectAccountSchema
);

