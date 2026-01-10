import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * WhatsApp Notification Log Model
 *
 * PURPOSE:
 * - Track all WhatsApp order notifications sent
 * - Ensure idempotency (no duplicate sends)
 * - Track delivery status
 * - Compliance audit trail
 *
 * RULES:
 * - One log entry per event per order per role
 * - Status updates via webhook
 */

export interface IWhatsAppNotificationLog extends Document {
  storeId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string; // Recipient user ID
  role: 'customer' | 'supplier' | 'reseller';
  phoneNumber: string; // E.164 format
  eventType: string; // Order lifecycle event
  templateName: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  providerMessageId?: string; // ID from Twilio/Meta
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  templateVariables?: Record<string, string>; // Snapshot of variables sent
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppNotificationLogSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: ['customer', 'supplier', 'reseller'],
      required: [true, 'Role is required'],
      index: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
      index: true,
    },
    templateName: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
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
      default: null,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    templateVariables: {
      type: Schema.Types.Mixed,
      default: {},
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

// Compound indexes for idempotency and queries
WhatsAppNotificationLogSchema.index({ orderId: 1, eventType: 1, role: 1 }, { unique: true }); // Prevent duplicates
WhatsAppNotificationLogSchema.index({ storeId: 1, status: 1, createdAt: -1 });
WhatsAppNotificationLogSchema.index({ phoneNumber: 1, status: 1 });
WhatsAppNotificationLogSchema.index({ providerMessageId: 1 });

export const WhatsAppNotificationLog: Model<IWhatsAppNotificationLog> =
  mongoose.models.WhatsAppNotificationLog ||
  mongoose.model<IWhatsAppNotificationLog>('WhatsAppNotificationLog', WhatsAppNotificationLogSchema);

