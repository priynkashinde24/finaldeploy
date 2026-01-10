import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * WhatsApp Message Log Model
 *
 * PURPOSE:
 * - Track all WhatsApp messages sent for cart recovery
 * - Prevent duplicate sends
 * - Track delivery status
 * - Compliance audit trail
 *
 * RULES:
 * - One log per message attempt
 * - Status transitions: queued → sent → delivered/failed
 */

export interface IWhatsAppMessageLog extends Document {
  storeId: mongoose.Types.ObjectId;
  cartId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | string;
  phoneNumber: string; // E.164 format (e.g., +1234567890)
  templateName: string; // WhatsApp template name (must be approved)
  messageType: 'abandoned_cart_1' | 'abandoned_cart_2' | 'abandoned_cart_3';
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  providerMessageId?: string; // Provider's message ID (Twilio SID, etc.)
  provider?: 'twilio' | 'meta_bsp'; // Provider used
  errorMessage?: string; // Error if failed
  sentAt?: Date;
  deliveredAt?: Date;
  scheduledFor?: Date; // When message should be sent
  retryCount: number; // Number of retry attempts
  recoveryTokenId?: mongoose.Types.ObjectId; // Link to recovery token
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppMessageLogSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    cartId: {
      type: Schema.Types.ObjectId,
      ref: 'Cart',
      required: [true, 'Cart ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    templateName: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['abandoned_cart_1', 'abandoned_cart_2', 'abandoned_cart_3'],
      required: [true, 'Message type is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'failed', 'cancelled'],
      default: 'queued',
      required: true,
      index: true,
    },
    providerMessageId: {
      type: String,
      trim: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['twilio', 'meta_bsp'],
      default: 'twilio',
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    sentAt: {
      type: Date,
      default: null,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    scheduledFor: {
      type: Date,
      required: [true, 'Scheduled time is required'],
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    recoveryTokenId: {
      type: Schema.Types.ObjectId,
      ref: 'CartRecoveryToken',
      default: null,
      index: true,
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
WhatsAppMessageLogSchema.index({ storeId: 1, status: 1, scheduledFor: 1 });
WhatsAppMessageLogSchema.index({ cartId: 1, messageType: 1 });
WhatsAppMessageLogSchema.index({ phoneNumber: 1, status: 1 });
WhatsAppMessageLogSchema.index({ scheduledFor: 1, status: 1 }); // For job queries

export const WhatsAppMessageLog: Model<IWhatsAppMessageLog> =
  mongoose.models.WhatsAppMessageLog ||
  mongoose.model<IWhatsAppMessageLog>('WhatsAppMessageLog', WhatsAppMessageLogSchema);

