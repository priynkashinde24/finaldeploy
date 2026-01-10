import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrderMessageThread extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId | string;
  customerId?: mongoose.Types.ObjectId | string | null;
  status: 'open' | 'closed';
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderMessageThreadSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
OrderMessageThreadSchema.index({ storeId: 1, orderId: 1 }, { unique: true }); // One thread per order
OrderMessageThreadSchema.index({ storeId: 1, status: 1, lastMessageAt: -1 }); // Get threads by store and status
OrderMessageThreadSchema.index({ customerId: 1, status: 1, lastMessageAt: -1 }); // Get customer threads
OrderMessageThreadSchema.index({ orderId: 1 }); // Quick lookup by orderId

export const OrderMessageThread: Model<IOrderMessageThread> =
  mongoose.models.OrderMessageThread || mongoose.model<IOrderMessageThread>('OrderMessageThread', OrderMessageThreadSchema);

