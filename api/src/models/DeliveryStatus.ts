import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Delivery Status Model
 * 
 * PURPOSE:
 * - Track delivery status for orders
 * - Link to delivery partners
 * - Store delivery updates from webhooks
 */

export interface IDeliveryStatus extends Document {
  orderId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  deliveryPartnerId?: mongoose.Types.ObjectId;
  trackingNumber?: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  currentLocation?: string;
  estimatedDeliveryDate?: Date;
  deliveredAt?: Date;
  deliveryNotes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryStatusSchema: Schema = new Schema(
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
    deliveryPartnerId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      index: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
      default: 'pending',
      index: true,
    },
    currentLocation: {
      type: String,
      trim: true,
    },
    estimatedDeliveryDate: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    deliveryNotes: {
      type: String,
      trim: true,
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

DeliveryStatusSchema.index({ orderId: 1, storeId: 1 });
DeliveryStatusSchema.index({ trackingNumber: 1 });
DeliveryStatusSchema.index({ status: 1, createdAt: 1 });

export const DeliveryStatus: Model<IDeliveryStatus> = mongoose.model<IDeliveryStatus>(
  'DeliveryStatus',
  DeliveryStatusSchema
);

