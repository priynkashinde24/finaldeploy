import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Geo Heatmap Snapshot Model
 * 
 * PURPOSE:
 * - Pre-aggregated daily geographic sales metrics by location
 * - One snapshot per location (state/pincode) per day per scope
 * - Append-only (never recompute historical data)
 * - Used for geographic heatmap visualization
 * 
 * RULES:
 * - One snapshot per location per day per scope per entity
 * - Metrics calculated from orders with shipping addresses
 * - Never update historical snapshots
 */

export interface IGeoHeatmapSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;
  locationType: 'state' | 'pincode' | 'city';
  locationValue: string; // State name, pincode, or city name
  country: string;
  state?: string;
  city?: string;
  pincode?: string;
  date: string; // YYYY-MM-DD format

  // Sales metrics
  ordersCount: number;
  quantitySold: number;
  grossRevenue: number;
  netRevenue: number;
  averageOrderValue: number;

  // Payment method breakdown
  codOrdersCount: number;
  codRevenue: number;
  onlineOrdersCount: number;
  onlineRevenue: number;

  // Risk metrics
  returnsCount: number;
  returnRate: number;
  codFailureCount: number;
  codFailureRate: number;

  createdAt: Date;
  updatedAt: Date;
}

const GeoHeatmapSnapshotSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['admin', 'supplier', 'reseller'],
      required: [true, 'Scope is required'],
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    locationType: {
      type: String,
      enum: ['state', 'pincode', 'city'],
      required: [true, 'Location type is required'],
      index: true,
    },
    locationValue: {
      type: String,
      required: [true, 'Location value is required'],
      index: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      index: true,
    },
    state: {
      type: String,
      default: null,
      index: true,
    },
    city: {
      type: String,
      default: null,
      index: true,
    },
    pincode: {
      type: String,
      default: null,
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
      index: true,
    },
    ordersCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    quantitySold: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    grossRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    netRevenue: {
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
    codOrdersCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    onlineOrdersCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    onlineRevenue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    returnsCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    returnRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    codFailureCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codFailureRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
GeoHeatmapSnapshotSchema.index({ storeId: 1, scope: 1, locationType: 1, date: -1 });
GeoHeatmapSnapshotSchema.index({ storeId: 1, scope: 1, entityId: 1, locationType: 1, date: -1 });
GeoHeatmapSnapshotSchema.index({ locationType: 1, locationValue: 1, date: -1 });
GeoHeatmapSnapshotSchema.index({ state: 1, date: -1 });
GeoHeatmapSnapshotSchema.index({ pincode: 1, date: -1 });

// Unique constraint
GeoHeatmapSnapshotSchema.index(
  { storeId: 1, scope: 1, entityId: 1, locationType: 1, locationValue: 1, date: 1 },
  { unique: true }
);

// Prevent updates and deletes
GeoHeatmapSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('GeoHeatmapSnapshot records are immutable and cannot be updated or deleted');
});

export const GeoHeatmapSnapshot: Model<IGeoHeatmapSnapshot> =
  mongoose.models.GeoHeatmapSnapshot || mongoose.model<IGeoHeatmapSnapshot>('GeoHeatmapSnapshot', GeoHeatmapSnapshotSchema);

