import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Payment Intent Model
 * 
 * PURPOSE:
 * - Track Stripe payment intents
 * - Link orders and subscriptions to Stripe payments
 * - Store payment status
 * - Stripe is source of truth for payment status
 * 
 * RULES:
 * - One PaymentIntent per order
 * - Stripe is source of truth
 * - Never mark paid outside webhook
 */

export interface IPaymentIntent extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  orderId?: mongoose.Types.ObjectId; // Order reference (nullable for subscriptions)
  subscriptionId?: mongoose.Types.ObjectId; // Subscription reference (nullable for orders)
  stripePaymentIntentId: string; // Stripe PaymentIntent ID
  stripeEventId?: string; // Stripe event ID for idempotency
  amount: number; // Amount in cents
  currency: string; // Currency code (e.g., 'usd')
  status: 'created' | 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'succeeded' | 'canceled' | 'failed';
  paymentStatus: 'pending' | 'paid' | 'failed'; // Our internal status
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const PaymentIntentSchema: Schema = new Schema(
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
      default: null,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: [true, 'Stripe PaymentIntent ID is required'],
      unique: true,
      index: true,
    },
    stripeEventId: {
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
      enum: [
        'created',
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
        'requires_capture',
        'succeeded',
        'canceled',
        'failed',
      ],
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

// Unique constraint: One PaymentIntent per order
PaymentIntentSchema.index({ storeId: 1, orderId: 1 }, { unique: true, sparse: true });

// Compound indexes for common queries
PaymentIntentSchema.index({ storeId: 1, paymentStatus: 1 });
PaymentIntentSchema.index({ storeId: 1, status: 1 });
PaymentIntentSchema.index({ stripeEventId: 1 }); // For idempotency checks

// Validation: Ensure either orderId or subscriptionId is set
PaymentIntentSchema.pre('save', async function (next) {
  if (!this.orderId && !this.subscriptionId) {
    return next(new Error('Either orderId or subscriptionId must be set'));
  }
  next();
});

export const PaymentIntent: Model<IPaymentIntent> = mongoose.model<IPaymentIntent>(
  'PaymentIntent',
  PaymentIntentSchema
);

