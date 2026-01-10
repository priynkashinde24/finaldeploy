import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Order Status History Model
 * 
 * PURPOSE:
 * - Track all order status transitions
 * - Build timeline for order tracking page
 * - Audit trail for status changes
 * 
 * RULES:
 * - One record per status transition
 * - Immutable (never updated)
 * - Used for timeline rendering
 */

export interface IOrderStatusHistory extends Document {
  orderId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  fromStatus: string;
  toStatus: string;
  actorRole: 'admin' | 'supplier' | 'delivery' | 'customer' | 'system';
  actorId?: mongoose.Types.ObjectId | null;
  timestamp: Date;
  metadata?: {
    reason?: string;
    trackingNumber?: string;
    notes?: string;
    returnReason?: string;
    cancellationReason?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

const OrderStatusHistorySchema: Schema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    fromStatus: {
      type: String,
      required: [true, 'From status is required'],
    },
    toStatus: {
      type: String,
      required: [true, 'To status is required'],
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['admin', 'supplier', 'delivery', 'customer', 'system'],
      required: [true, 'Actor role is required'],
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      default: Date.now,
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

// Compound indexes for efficient timeline queries
OrderStatusHistorySchema.index({ orderId: 1, timestamp: 1 });
OrderStatusHistorySchema.index({ storeId: 1, orderId: 1, timestamp: 1 });

export const OrderStatusHistory: Model<IOrderStatusHistory> =
  mongoose.models.OrderStatusHistory ||
  mongoose.model<IOrderStatusHistory>('OrderStatusHistory', OrderStatusHistorySchema);

