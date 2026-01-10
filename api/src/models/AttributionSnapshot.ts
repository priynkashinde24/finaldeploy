import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Attribution Snapshot Model
 * 
 * PURPOSE:
 * - Pre-aggregated daily attribution metrics by channel
 * - One snapshot per channel per attribution model per day
 * - Append-only (never recompute historical data)
 * 
 * RULES:
 * - One snapshot per channel per model per day per store
 * - Metrics calculated from touches, signups, orders
 * - Never update historical snapshots
 */

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay';

export interface IAttributionSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format
  channel: string; // Marketing channel
  attributionModel: AttributionModel; // Attribution model used

  // Traffic metrics
  visits: number; // Number of visits/touches
  uniqueVisitors: number; // Unique visitors

  // Conversion metrics
  signups: number; // Signups attributed to this channel
  orders: number; // Orders attributed to this channel
  conversionRate: number; // (orders / visits) * 100

  // Revenue metrics
  revenue: number; // Total revenue attributed
  averageOrderValue: number; // Revenue / orders

  // Cost metrics (if available)
  cost?: number; // Marketing cost for this channel
  roi?: number; // Return on investment ((revenue - cost) / cost) * 100

  createdAt: Date;
  updatedAt: Date;
}

const AttributionSnapshotSchema: Schema = new Schema(
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
    attributionModel: {
      type: String,
      enum: ['first_touch', 'last_touch', 'linear', 'time_decay'],
      required: [true, 'Attribution model is required'],
      index: true,
    },
    visits: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    uniqueVisitors: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    signups: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    orders: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    conversionRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    revenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    averageOrderValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    cost: {
      type: Number,
      min: 0,
    },
    roi: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
AttributionSnapshotSchema.index({ storeId: 1, date: -1, channel: 1, attributionModel: 1 });
AttributionSnapshotSchema.index({ storeId: 1, channel: 1, date: -1 });
AttributionSnapshotSchema.index({ date: 1, attributionModel: 1 });

// Unique constraint: one snapshot per channel per model per day per store
AttributionSnapshotSchema.index(
  { storeId: 1, date: 1, channel: 1, attributionModel: 1 },
  { unique: true }
);

// Prevent updates and deletes
AttributionSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('AttributionSnapshot records are immutable and cannot be updated or deleted');
});

export const AttributionSnapshot: Model<IAttributionSnapshot> =
  mongoose.models.AttributionSnapshot || mongoose.model<IAttributionSnapshot>('AttributionSnapshot', AttributionSnapshotSchema);

