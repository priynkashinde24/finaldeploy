import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SMS Notification Log Model
 *
 * PURPOSE:
 * - Track all SMS order notifications sent
 * - Ensure idempotency (no duplicate sends)
 * - Track delivery status
 * - Compliance audit trail
 *
 * RULES:
 * - One log entry per event per order per role
 * - Status updates via webhook
 */

export interface ISMSNotificationLog extends Document {
  storeId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string; // Recipient user ID
  role: 'customer' | 'supplier' | 'reseller';
  phoneNumber: string; // E.164 format
  eventType: string; // Order lifecycle event
  message: string; // Final rendered message
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  providerMessageId?: string; // ID from SMS provider
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SMSNotificationLogSchema: Schema = new Schema(
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
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
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
SMSNotificationLogSchema.index({ orderId: 1, eventType: 1, role: 1 }, { unique: true }); // Prevent duplicates
SMSNotificationLogSchema.index({ storeId: 1, status: 1, createdAt: -1 });
SMSNotificationLogSchema.index({ phoneNumber: 1, status: 1 });
SMSNotificationLogSchema.index({ providerMessageId: 1 });
SMSNotificationLogSchema.index({ status: 1, retryCount: 1, createdAt: 1 }); // For retry job

export const SMSNotificationLog: Model<ISMSNotificationLog> =
  mongoose.models.SMSNotificationLog ||
  mongoose.model<ISMSNotificationLog>('SMSNotificationLog', SMSNotificationLogSchema);

