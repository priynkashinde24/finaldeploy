import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Throttle Log Model
 * 
 * PURPOSE:
 * - Log all throttling events
 * - Track throttling statistics
 * - Monitor abuse patterns
 * - Audit throttling decisions
 */

export type ThrottleScope = 'global' | 'user' | 'ip' | 'endpoint' | 'user-endpoint' | 'ip-endpoint';

export interface IThrottleLog extends Document {
  ruleId?: mongoose.Types.ObjectId | null; // Reference to ThrottleRule
  scope: ThrottleScope;
  identifier: string; // User ID, IP, endpoint, etc.
  allowed: boolean; // Whether request was allowed
  remaining: number; // Remaining requests in window
  ipAddress: string;
  userAgent: string;
  endpoint: string; // Method + path
  retryAfter?: number; // Seconds to wait before retry
  reason?: string; // Reason for blocking
  createdAt: Date;
}

const ThrottleLogSchema: Schema = new Schema(
  {
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'ThrottleRule',
      default: null,
      index: true,
    },
    scope: {
      type: String,
      enum: ['global', 'user', 'ip', 'endpoint', 'user-endpoint', 'ip-endpoint'],
      required: true,
      index: true,
    },
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    allowed: {
      type: Boolean,
      required: true,
      index: true,
    },
    remaining: {
      type: Number,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      index: true,
    },
    retryAfter: {
      type: Number,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ThrottleLogSchema.index({ createdAt: -1 }); // Time-based queries
ThrottleLogSchema.index({ ruleId: 1, createdAt: -1 }); // Rule-based queries
ThrottleLogSchema.index({ scope: 1, identifier: 1, createdAt: -1 }); // Identifier queries
ThrottleLogSchema.index({ allowed: 1, createdAt: -1 }); // Blocked requests
ThrottleLogSchema.index({ ipAddress: 1, createdAt: -1 }); // IP-based queries

// TTL index: Delete logs older than 90 days
ThrottleLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export const ThrottleLog: Model<IThrottleLog> = mongoose.model<IThrottleLog>(
  'ThrottleLog',
  ThrottleLogSchema
);

