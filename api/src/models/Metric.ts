import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMetric extends Document {
  storeId: string;
  metricName: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
  createdAt: Date;
}

const MetricSchema: Schema = new Schema(
  {
    storeId: {
      type: String,
      required: [true, 'Store ID is required'],
      trim: true,
      index: true,
    },
    metricName: {
      type: String,
      required: [true, 'Metric name is required'],
      trim: true,
      index: true,
    },
    value: {
      type: Number,
      required: [true, 'Metric value is required'],
    },
    tags: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for time-series queries
MetricSchema.index({ storeId: 1, metricName: 1, timestamp: -1 });
MetricSchema.index({ storeId: 1, timestamp: -1 });
MetricSchema.index({ metricName: 1, timestamp: -1 });

export const Metric: Model<IMetric> =
  mongoose.models.Metric || mongoose.model<IMetric>('Metric', MetricSchema);

