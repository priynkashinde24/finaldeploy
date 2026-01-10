import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Stripe Webhook Event Model
 * 
 * PURPOSE:
 * - Track processed webhook events for idempotency
 * - Prevent duplicate processing
 * - Audit trail of webhook events
 * 
 * RULES:
 * - One record per Stripe event ID
 * - Used for idempotency checks
 */

export interface IStripeWebhookEvent extends Document {
  stripeEventId: string; // Stripe event ID (unique)
  eventType: string; // Stripe event type (e.g., 'payment_intent.succeeded')
  processed: boolean; // Whether event was successfully processed
  processedAt?: Date; // When event was processed
  error?: string; // Error message if processing failed
  metadata?: Record<string, any>; // Event metadata
  createdAt: Date;
  updatedAt: Date;
}

const StripeWebhookEventSchema: Schema = new Schema(
  {
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
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
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

// Index for finding unprocessed events
StripeWebhookEventSchema.index({ processed: 1, createdAt: 1 });

export const StripeWebhookEvent: Model<IStripeWebhookEvent> = mongoose.model<IStripeWebhookEvent>(
  'StripeWebhookEvent',
  StripeWebhookEventSchema
);

