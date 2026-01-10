import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Marketing Touch Model
 * 
 * PURPOSE:
 * - Track individual marketing touches (visits, clicks, impressions)
 * - Capture UTM parameters and referrer information
 * - Immutable record of marketing interaction
 * 
 * RULES:
 * - One touch per session entry
 * - Immutable (never updated)
 * - Links to AttributionSession
 */

export type MarketingChannel =
  | 'direct'
  | 'organic_search'
  | 'paid_search'
  | 'social'
  | 'paid_social'
  | 'email'
  | 'whatsapp'
  | 'sms'
  | 'referral'
  | 'affiliate'
  | 'influencer'
  | 'unknown';

export interface IMarketingTouch extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  sessionId: string; // Session identifier (from cookie or generated)
  userId?: mongoose.Types.ObjectId | string | null; // User ID if known

  // Channel classification
  channel: MarketingChannel;
  source?: string; // UTM source or referrer source
  medium?: string; // UTM medium
  campaign?: string; // UTM campaign
  content?: string; // UTM content
  term?: string; // UTM term

  // Referrer information
  landingPage: string; // First page visited
  referrerUrl?: string; // HTTP referrer
  referrerDomain?: string; // Extracted referrer domain

  // Device and context
  userAgent?: string;
  ipAddress?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  country?: string;

  // Timestamp
  occurredAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const MarketingTouchSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    channel: {
      type: String,
      enum: [
        'direct',
        'organic_search',
        'paid_search',
        'social',
        'paid_social',
        'email',
        'whatsapp',
        'sms',
        'referral',
        'affiliate',
        'influencer',
        'unknown',
      ],
      required: [true, 'Channel is required'],
      index: true,
    },
    source: {
      type: String,
      trim: true,
      index: true,
    },
    medium: {
      type: String,
      trim: true,
      index: true,
    },
    campaign: {
      type: String,
      trim: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
    },
    term: {
      type: String,
      trim: true,
    },
    landingPage: {
      type: String,
      required: [true, 'Landing page is required'],
    },
    referrerUrl: {
      type: String,
      trim: true,
    },
    referrerDomain: {
      type: String,
      trim: true,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
    },
    country: {
      type: String,
      trim: true,
      index: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
MarketingTouchSchema.index({ storeId: 1, sessionId: 1, occurredAt: -1 });
MarketingTouchSchema.index({ storeId: 1, userId: 1, occurredAt: -1 });
MarketingTouchSchema.index({ storeId: 1, channel: 1, occurredAt: -1 });
MarketingTouchSchema.index({ sessionId: 1, occurredAt: 1 });

// Prevent updates and deletes (immutable)
MarketingTouchSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('MarketingTouch records are immutable and cannot be updated or deleted');
});

export const MarketingTouch: Model<IMarketingTouch> =
  mongoose.models.MarketingTouch || mongoose.model<IMarketingTouch>('MarketingTouch', MarketingTouchSchema);

