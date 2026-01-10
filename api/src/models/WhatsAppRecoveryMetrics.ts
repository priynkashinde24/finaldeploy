import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * WhatsApp Recovery Metrics Model
 *
 * PURPOSE:
 * - Track WhatsApp recovery message performance
 * - Measure conversion rates
 * - Analytics for WhatsApp cart recovery
 *
 * RULES:
 * - One record per WhatsApp message sent
 * - Tracks delivery, clicks, conversions
 */

export interface IWhatsAppRecoveryMetrics extends Document {
  storeId: mongoose.Types.ObjectId;
  cartId: mongoose.Types.ObjectId;
  messageLogId: mongoose.Types.ObjectId;
  phoneNumber: string;
  messageType: 'abandoned_cart_1' | 'abandoned_cart_2' | 'abandoned_cart_3';
  sentAt: Date;
  deliveredAt?: Date;
  clickedAt?: Date; // When recovery link was clicked
  recoveredAt?: Date; // When cart was recovered via link
  convertedAt?: Date; // When order was created from recovered cart
  orderId?: mongoose.Types.ObjectId;
  revenue?: number; // Revenue from converted order
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppRecoveryMetricsSchema: Schema = new Schema(
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
    messageLogId: {
      type: Schema.Types.ObjectId,
      ref: 'WhatsAppMessageLog',
      required: [true, 'Message log ID is required'],
      index: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: ['abandoned_cart_1', 'abandoned_cart_2', 'abandoned_cart_3'],
      required: [true, 'Message type is required'],
      index: true,
    },
    sentAt: {
      type: Date,
      required: [true, 'Sent at date is required'],
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    clickedAt: {
      type: Date,
      default: null,
      index: true,
    },
    recoveredAt: {
      type: Date,
      default: null,
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    revenue: {
      type: Number,
      min: 0,
      default: 0,
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
WhatsAppRecoveryMetricsSchema.index({ storeId: 1, sentAt: -1 });
WhatsAppRecoveryMetricsSchema.index({ storeId: 1, convertedAt: -1 });
WhatsAppRecoveryMetricsSchema.index({ cartId: 1, messageType: 1 });

export const WhatsAppRecoveryMetrics: Model<IWhatsAppRecoveryMetrics> =
  mongoose.models.WhatsAppRecoveryMetrics ||
  mongoose.model<IWhatsAppRecoveryMetrics>('WhatsAppRecoveryMetrics', WhatsAppRecoveryMetricsSchema);

