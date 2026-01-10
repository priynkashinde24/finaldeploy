import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Payment Model
 * 
 * PURPOSE:
 * - Track payments from multiple providers (PayPal, Stripe, Razorpay)
 * - Link orders to payment providers
 * - Store payment status
 * - Webhook is source of truth for payment status
 * 
 * RULES:
 * - One payment per order per provider
 * - Webhook is final authority
 * - Never mark paid outside webhook
 */

export interface IPayment extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  orderId: mongoose.Types.ObjectId; // Order reference
  provider: 'paypal' | 'stripe' | 'razorpay' | 'crypto'; // Payment provider
  providerOrderId: string; // Provider's order ID (e.g., PayPal order ID, Stripe PaymentIntent ID)
  providerEventId?: string; // Provider's webhook event ID for idempotency
  amount: number; // Amount in smallest currency unit (cents/paise)
  currency: string; // Currency code (e.g., 'usd', 'inr')
  status: 'created' | 'approved' | 'paid' | 'failed' | 'canceled'; // Payment status
  paymentStatus: 'pending' | 'paid' | 'failed'; // Our internal status
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema(
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
    provider: {
      type: String,
      enum: ['paypal', 'stripe', 'razorpay', 'crypto'],
      required: [true, 'Provider is required'],
      index: true,
    },
    providerOrderId: {
      type: String,
      required: [true, 'Provider order ID is required'],
      index: true,
    },
    providerEventId: {
      type: String,
      default: null,
      index: true,
      // For idempotency: track processed webhook events
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
    status: {
      type: String,
      enum: ['created', 'approved', 'paid', 'failed', 'canceled'],
      default: 'created',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
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

// Unique constraint: One payment per order per provider
PaymentSchema.index({ storeId: 1, orderId: 1, provider: 1 }, { unique: true });

// Compound indexes for common queries
PaymentSchema.index({ storeId: 1, provider: 1, paymentStatus: 1 });
PaymentSchema.index({ storeId: 1, providerOrderId: 1 }); // Find by provider order ID
PaymentSchema.index({ providerEventId: 1 }); // For idempotency checks

export const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', PaymentSchema);

