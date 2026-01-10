import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Marketing Cost Model
 * 
 * PURPOSE:
 * - Track marketing spend per channel/campaign
 * - Enable ROI calculations
 * - Support cost import/export
 * 
 * RULES:
 * - Costs can be updated (unlike snapshots)
 * - One cost record per channel per campaign per day
 */

export interface IMarketingCost extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format
  channel: string; // Marketing channel
  campaign?: string; // Campaign name (optional)
  cost: number; // Cost amount
  currency?: string; // Currency code (default: USD)
  notes?: string; // Optional notes

  createdAt: Date;
  updatedAt: Date;
}

const MarketingCostSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
      index: true,
    },
    channel: {
      type: String,
      required: [true, 'Channel is required'],
      index: true,
    },
    campaign: {
      type: String,
      trim: true,
      index: true,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
MarketingCostSchema.index({ storeId: 1, date: -1, channel: 1 });
MarketingCostSchema.index({ storeId: 1, channel: 1, date: -1 });
MarketingCostSchema.index({ date: 1, channel: 1 });

// Unique constraint: one cost per channel per day
MarketingCostSchema.index(
  { storeId: 1, date: 1, channel: 1, campaign: 1 },
  { unique: true, partialFilterExpression: { campaign: { $exists: true } } }
);

MarketingCostSchema.index(
  { storeId: 1, date: 1, channel: 1 },
  { unique: true, partialFilterExpression: { campaign: { $exists: false } } }
);

export const MarketingCost: Model<IMarketingCost> =
  mongoose.models.MarketingCost || mongoose.model<IMarketingCost>('MarketingCost', MarketingCostSchema);

