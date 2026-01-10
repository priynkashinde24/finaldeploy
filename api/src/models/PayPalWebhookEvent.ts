import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * PayPal Webhook Event Model
 * 
 * PURPOSE:
 * - Track processed PayPal webhook events for idempotency
 * - Prevent duplicate processing
 * - Audit trail of webhook events
 * 
 * RULES:
 * - One record per PayPal event ID
 * - Used for idempotency checks
 */

export interface IPayPalWebhookEvent extends Document {
  paypalEventId: string; // PayPal event ID (unique)
  eventType: string; // PayPal event type (e.g., 'PAYMENT.CAPTURE.COMPLETED')
  processed: boolean; // Whether event was successfully processed
  processedAt?: Date; // When event was processed
  error?: string; // Error message if processing failed
  metadata?: Record<string, any>; // Event metadata
  createdAt: Date;
  updatedAt: Date;
}

const PayPalWebhookEventSchema: Schema = new Schema(
  {
    paypalEventId: {
      type: String,
      required: [true, 'PayPal event ID is required'],
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
PayPalWebhookEventSchema.index({ processed: 1, createdAt: 1 });

export const PayPalWebhookEvent: Model<IPayPalWebhookEvent> = mongoose.model<IPayPalWebhookEvent>(
  'PayPalWebhookEvent',
  PayPalWebhookEventSchema
);

