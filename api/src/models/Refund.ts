import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Refund Model
 * 
 * PURPOSE:
 * - Track refunds for orders
 * - Support full and partial refunds
 * - Link to inventory restoration
 */

export interface IRefund extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  orderId: string; // Order ID
  paymentIntentId: string; // Payment provider ID (Stripe PaymentIntent ID, PayPal Order ID, etc.)
  stripeRefundId?: string; // Stripe Refund ID (if created)
  paypalRefundId?: string; // PayPal Refund ID (if created)
  refundType: 'full' | 'partial'; // Type of refund
  amount: number; // Refund amount in cents
  currency: string; // Currency code
  reason?: string; // Refund reason
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'; // Refund status
  itemsRefunded: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    amount: number; // Refund amount for this item
  }>; // Items being refunded
  inventoryRestored: boolean; // Whether inventory was restored
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema: Schema = new Schema(
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
    paymentIntentId: {
      type: String,
      required: [true, 'PaymentIntent ID is required'],
      index: true,
    },
    stripeRefundId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    paypalRefundId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    refundType: {
      type: String,
      enum: ['full', 'partial'],
      required: [true, 'Refund type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be non-negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      default: 'usd',
      uppercase: true,
    },
    reason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'canceled'],
      default: 'pending',
      index: true,
    },
    itemsRefunded: {
      type: [
        {
          productId: String,
          variantId: String,
          quantity: Number,
          amount: Number,
        },
      ],
      default: [],
    },
    inventoryRestored: {
      type: Boolean,
      default: false,
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
RefundSchema.index({ storeId: 1, orderId: 1 });
RefundSchema.index({ storeId: 1, status: 1 });
RefundSchema.index({ paymentIntentId: 1 });

export const Refund: Model<IRefund> = mongoose.model<IRefund>('Refund', RefundSchema);

