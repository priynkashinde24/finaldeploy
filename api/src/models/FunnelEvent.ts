import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Funnel Event Model
 * 
 * PURPOSE:
 * - Track conversion funnel events (page views, product views, cart actions, checkout, payment, orders)
 * - Immutable event log for conversion analytics
 * - One event per session + entity combination
 * 
 * RULES:
 * - Events are immutable (never updated or deleted)
 * - Logged once per session + entity
 * - Used to generate conversion snapshots
 */

export type FunnelEventType =
  | 'PAGE_VIEW'
  | 'PRODUCT_VIEW'
  | 'ADD_TO_CART'
  | 'CHECKOUT_STARTED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_SUCCESS'
  | 'ORDER_CONFIRMED'
  | 'CART_VIEW';

export interface IFunnelEvent extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  sessionId: string; // Session identifier (from cookie or user session)
  userId?: mongoose.Types.ObjectId | string | null; // User ID if authenticated
  eventType: FunnelEventType;
  entityId?: mongoose.Types.ObjectId | string | null; // productId, cartId, or orderId
  occurredAt: Date; // Event time from client (fallback: createdAt)
  device?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  source?: string; // marketing/source identifier (utm_source or referrer domain)
  pagePath?: string; // optional page path for PAGE_VIEW
  metadata?: Record<string, any>; // Additional event data (payment method, etc.)
  createdAt: Date;
  updatedAt: Date;
}

const FunnelEventSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'PAGE_VIEW',
        'PRODUCT_VIEW',
        'ADD_TO_CART',
        'CHECKOUT_STARTED',
        'PAYMENT_INITIATED',
        'PAYMENT_SUCCESS',
        'ORDER_CONFIRMED',
        'CART_VIEW',
      ],
      required: [true, 'Event type is required'],
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      // Examples: { paymentMethod: 'stripe', cartValue: 100, productCategory: 'electronics' }
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
      // Preferred event timestamp (client or server-captured)
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    pagePath: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
FunnelEventSchema.index({ storeId: 1, createdAt: -1 }); // Primary query pattern
FunnelEventSchema.index({ storeId: 1, sessionId: 1, createdAt: -1 }); // Session tracking
FunnelEventSchema.index({ storeId: 1, eventType: 1, createdAt: -1 }); // Event type queries
FunnelEventSchema.index({ storeId: 1, userId: 1, createdAt: -1 }); // User-specific queries
FunnelEventSchema.index({ sessionId: 1, eventType: 1 }); // Session + event type
FunnelEventSchema.index({ storeId: 1, occurredAt: -1 }); // Date range queries (preferred)
FunnelEventSchema.index({ storeId: 1, eventType: 1, occurredAt: -1 }); // Event type + time
FunnelEventSchema.index({ storeId: 1, source: 1, occurredAt: -1 }); // Source filtering
FunnelEventSchema.index({ storeId: 1, device: 1, occurredAt: -1 }); // Device filtering

// Prevent updates and deletes (events are immutable)
FunnelEventSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('FunnelEvent records are immutable and cannot be updated or deleted');
});

export const FunnelEvent: Model<IFunnelEvent> =
  mongoose.models.FunnelEvent || mongoose.model<IFunnelEvent>('FunnelEvent', FunnelEventSchema);

