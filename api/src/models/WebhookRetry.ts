import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Webhook Retry Model
 * 
 * PURPOSE:
 * - Track webhook processing failures
 * - Enable retry logic
 * - Monitor webhook health
 */

export interface IWebhookRetry extends Document {
  storeId?: mongoose.Types.ObjectId; // Store (tenant) reference (optional)
  stripeEventId: string; // Stripe event ID
  eventType: string; // Event type
  retryCount: number; // Number of retry attempts
  lastAttemptAt: Date; // Last retry attempt timestamp
  nextRetryAt?: Date; // Next retry timestamp
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'abandoned'; // Retry status
  error?: string; // Last error message
  maxRetries: number; // Maximum retry attempts
  metadata?: Record<string, any>; // Event metadata
  createdAt: Date;
  updatedAt: Date;
}

const WebhookRetrySchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    stripeEventId: {
      type: String,
      required: [true, 'Stripe event ID is required'],
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: [0, 'Retry count must be non-negative'],
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'abandoned'],
      default: 'pending',
      index: true,
    },
    error: {
      type: String,
      default: null,
    },
    maxRetries: {
      type: Number,
      default: 5,
      min: [1, 'Max retries must be at least 1'],
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
WebhookRetrySchema.index({ status: 1, nextRetryAt: 1 }); // For finding retries to process
WebhookRetrySchema.index({ storeId: 1, status: 1 });

export const WebhookRetry: Model<IWebhookRetry> = mongoose.model<IWebhookRetry>(
  'WebhookRetry',
  WebhookRetrySchema
);

