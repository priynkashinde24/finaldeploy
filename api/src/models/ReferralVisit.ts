import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Referral Visit Tracking Model
 *
 * PURPOSE:
 * - Track referral link visits
 * - Attribute visit → signup → order
 * - Fraud detection via IP/userAgent
 *
 * RULES:
 * - One visit per visitorId per referral code
 * - Tracks conversion chain
 */

export interface IReferralVisit extends Document {
  storeId: mongoose.Types.ObjectId;
  referralCode: string; // Referral code used
  visitorId: string; // Cookie/session ID
  ip: string; // Visitor IP address
  userAgent?: string; // Browser user agent
  landedAt: Date; // When visitor landed
  convertedUserId?: mongoose.Types.ObjectId | string; // User who signed up (if converted)
  convertedOrderId?: mongoose.Types.ObjectId | string; // First order ID (if converted)
  convertedAt?: Date; // When conversion happened
  isFraud?: boolean; // Fraud flag
  fraudReason?: string; // Reason if flagged as fraud
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralVisitSchema: Schema = new Schema(
  {
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
    visitorId: {
      type: String,
      required: [true, 'Visitor ID is required'],
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      required: [true, 'IP address is required'],
      trim: true,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    landedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    convertedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    convertedOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
      index: true,
    },
    isFraud: {
      type: Boolean,
      default: false,
      index: true,
    },
    fraudReason: {
      type: String,
      trim: true,
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
ReferralVisitSchema.index({ storeId: 1, referralCode: 1, landedAt: -1 });
ReferralVisitSchema.index({ visitorId: 1, referralCode: 1 }, { unique: true }); // One visit per visitor per code
ReferralVisitSchema.index({ ip: 1, referralCode: 1 }); // For fraud detection
ReferralVisitSchema.index({ convertedUserId: 1, convertedOrderId: 1 });
ReferralVisitSchema.index({ referralCode: 1, isFraud: 1 });

export const ReferralVisit: Model<IReferralVisit> =
  mongoose.models.ReferralVisit || mongoose.model<IReferralVisit>('ReferralVisit', ReferralVisitSchema);

