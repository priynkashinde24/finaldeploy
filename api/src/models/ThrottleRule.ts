import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Throttle Rule Model
 * 
 * PURPOSE:
 * - Define throttling rules for different endpoints/users/IPs
 * - Support multiple throttling strategies
 * - Enable/disable rules dynamically
 * - Track rule usage
 */

export type ThrottleStrategy = 'sliding-window' | 'token-bucket' | 'leaky-bucket' | 'fixed-window';
export type ThrottleScope = 'global' | 'user' | 'ip' | 'endpoint' | 'user-endpoint' | 'ip-endpoint';

export interface IThrottleRule extends Document {
  name: string; // Rule name
  description?: string;
  
  // Throttling configuration
  strategy: ThrottleStrategy;
  scope: ThrottleScope;
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
  
  // Token bucket specific
  bucketSize?: number; // Bucket size (for token-bucket strategy)
  refillRate?: number; // Refill rate (requests per second)
  
  // Blocking
  blockDuration?: number; // Duration to block after limit exceeded (ms)
  
  // Targeting
  endpointPattern?: string; // Regex pattern for endpoint matching
  userRoles?: string[]; // Apply to specific user roles
  ipWhitelist?: string[]; // IPs to exclude from throttling
  ipBlacklist?: string[]; // IPs to always throttle
  
  // Status
  active: boolean;
  priority: number; // Higher priority rules are checked first
  
  // Metadata
  storeId?: mongoose.Types.ObjectId | null; // Store-specific rules
  createdBy?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const ThrottleRuleSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    strategy: {
      type: String,
      enum: ['sliding-window', 'token-bucket', 'leaky-bucket', 'fixed-window'],
      required: true,
      default: 'sliding-window',
    },
    scope: {
      type: String,
      enum: ['global', 'user', 'ip', 'endpoint', 'user-endpoint', 'ip-endpoint'],
      required: true,
      default: 'ip',
    },
    maxRequests: {
      type: Number,
      required: true,
      min: 1,
    },
    windowMs: {
      type: Number,
      required: true,
      min: 1000, // Minimum 1 second
    },
    bucketSize: {
      type: Number,
      default: null,
      min: 1,
    },
    refillRate: {
      type: Number,
      default: null,
      min: 0.1, // Minimum 0.1 requests per second
    },
    blockDuration: {
      type: Number,
      default: null,
      min: 0,
    },
    endpointPattern: {
      type: String,
      default: null,
      trim: true,
    },
    userRoles: {
      type: [String],
      default: [],
    },
    ipWhitelist: {
      type: [String],
      default: [],
    },
    ipBlacklist: {
      type: [String],
      default: [],
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

// Indexes
ThrottleRuleSchema.index({ active: 1, priority: -1 }); // Find active rules by priority
ThrottleRuleSchema.index({ storeId: 1, active: 1 });
ThrottleRuleSchema.index({ endpointPattern: 1, active: 1 });

export const ThrottleRule: Model<IThrottleRule> = mongoose.model<IThrottleRule>(
  'ThrottleRule',
  ThrottleRuleSchema
);

