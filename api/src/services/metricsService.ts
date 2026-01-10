import { Metric } from '../models/Metric';
import { EventEmitter } from 'events';

// Event emitter for real-time updates
export const metricsEventEmitter = new EventEmitter();

export interface MetricRecord {
  storeId: string;
  metricName: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

/**
 * Record a metric
 */
export const recordMetric = async (
  storeId: string,
  metricName: string,
  value: number,
  tags: Record<string, string> = {},
  timestamp?: Date
): Promise<void> => {
  const metric = new Metric({
    storeId,
    metricName,
    value,
    tags,
    timestamp: timestamp || new Date(),
  });

  await metric.save();

  // Emit event for real-time updates
  metricsEventEmitter.emit('metric', {
    storeId,
    metricName,
    value,
    tags,
    timestamp: metric.timestamp,
  });
};

/**
 * Aggregate metrics hourly (skeleton)
 * In production, this would use aggregation pipelines or time-series database
 */
export const aggregateHourly = async (
  storeId: string,
  metricName: string,
  from: Date,
  to: Date
): Promise<Array<{ hour: Date; value: number }>> => {
  // This is a skeleton - in production, use MongoDB aggregation pipeline
  const metrics = await Metric.find({
    storeId,
    metricName,
    timestamp: { $gte: from, $lte: to },
  }).sort({ timestamp: 1 });

  // Group by hour (simplified)
  const hourlyMap = new Map<string, number>();

  metrics.forEach((metric) => {
    const hour = new Date(metric.timestamp);
    hour.setMinutes(0, 0, 0);
    const hourKey = hour.toISOString();

    hourlyMap.set(hourKey, (hourlyMap.get(hourKey) || 0) + metric.value);
  });

  return Array.from(hourlyMap.entries()).map(([hourKey, value]) => ({
    hour: new Date(hourKey),
    value,
  }));
};

/**
 * Aggregate metrics daily (skeleton)
 */
export const aggregateDaily = async (
  storeId: string,
  metricName: string,
  from: Date,
  to: Date
): Promise<Array<{ day: Date; value: number }>> => {
  const metrics = await Metric.find({
    storeId,
    metricName,
    timestamp: { $gte: from, $lte: to },
  }).sort({ timestamp: 1 });

  // Group by day
  const dailyMap = new Map<string, number>();

  metrics.forEach((metric) => {
    const day = new Date(metric.timestamp);
    day.setHours(0, 0, 0, 0);
    const dayKey = day.toISOString().split('T')[0];

    dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + metric.value);
  });

  return Array.from(dailyMap.entries()).map(([dayKey, value]) => ({
    day: new Date(dayKey),
    value,
  }));
};

/**
 * Get latest metric value
 */
export const getLatestMetric = async (
  storeId: string,
  metricName: string
): Promise<number | null> => {
  const metric = await Metric.findOne({ storeId, metricName })
    .sort({ timestamp: -1 })
    .limit(1);

  return metric ? metric.value : null;
};

/**
 * Get sum of metrics in date range
 */
export const getMetricSum = async (
  storeId: string,
  metricName: string,
  from: Date,
  to: Date
): Promise<number> => {
  const result = await Metric.aggregate([
    {
      $match: {
        storeId,
        metricName,
        timestamp: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$value' },
      },
    },
  ]);

  return result.length > 0 ? result[0].total : 0;
};

/**
 * Get count of metrics in date range
 */
export const getMetricCount = async (
  storeId: string,
  metricName: string,
  from: Date,
  to: Date
): Promise<number> => {
  return Metric.countDocuments({
    storeId,
    metricName,
    timestamp: { $gte: from, $lte: to },
  });
};

