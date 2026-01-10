import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Crypto Payment Model
 * 
 * PURPOSE:
 * - Track cryptocurrency payments (Bitcoin, Ethereum, USDT, etc.)
 * - Link orders to crypto payments
 * - Store wallet addresses, transaction hashes, and payment status
 * - Support multiple cryptocurrencies
 * 
 * RULES:
 * - One crypto payment per order per currency
 * - Blockchain confirmation is source of truth
 * - Payment expires after timeout period
 */

export type Cryptocurrency = 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'BNB' | 'MATIC';

export interface ICryptoPayment extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  orderId: mongoose.Types.ObjectId; // Order reference
  cryptocurrency: Cryptocurrency; // Cryptocurrency type
  walletAddress: string; // Wallet address for receiving payment
  amount: number; // Amount in fiat currency (USD/INR)
  amountInCrypto: number; // Amount in cryptocurrency (e.g., BTC, ETH)
  exchangeRate: number; // Exchange rate at time of payment creation
  currency: string; // Fiat currency code (e.g., 'USD', 'INR')
  status: 'pending' | 'confirming' | 'confirmed' | 'expired' | 'failed' | 'paid';
  paymentStatus: 'pending' | 'paid' | 'failed'; // Our internal status
  transactionHash?: string; // Blockchain transaction hash
  confirmations?: number; // Number of blockchain confirmations
  requiredConfirmations: number; // Required confirmations for payment
  expiresAt: Date; // Payment expiration time
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const CryptoPaymentSchema: Schema = new Schema(
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
    cryptocurrency: {
      type: String,
      enum: ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'MATIC'],
      required: [true, 'Cryptocurrency is required'],
      index: true,
    },
    walletAddress: {
      type: String,
      required: [true, 'Wallet address is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be non-negative'],
    },
    amountInCrypto: {
      type: Number,
      required: [true, 'Amount in cryptocurrency is required'],
      min: [0, 'Amount must be non-negative'],
    },
    exchangeRate: {
      type: Number,
      required: [true, 'Exchange rate is required'],
      min: [0, 'Exchange rate must be positive'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      default: 'USD',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirming', 'confirmed', 'expired', 'failed', 'paid'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    transactionHash: {
      type: String,
      default: null,
      index: true,
    },
    confirmations: {
      type: Number,
      default: 0,
      min: [0, 'Confirmations must be non-negative'],
    },
    requiredConfirmations: {
      type: Number,
      default: 3, // Default: 3 confirmations for most cryptocurrencies
      min: [1, 'Required confirmations must be at least 1'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration time is required'],
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

// Unique constraint: One crypto payment per order per cryptocurrency
CryptoPaymentSchema.index({ storeId: 1, orderId: 1, cryptocurrency: 1 }, { unique: true });

// Compound indexes for common queries
CryptoPaymentSchema.index({ storeId: 1, cryptocurrency: 1, paymentStatus: 1 });
CryptoPaymentSchema.index({ storeId: 1, walletAddress: 1 });
CryptoPaymentSchema.index({ transactionHash: 1 }); // Find by transaction hash
CryptoPaymentSchema.index({ expiresAt: 1 }); // For finding expired payments
CryptoPaymentSchema.index({ status: 1, expiresAt: 1 }); // For cleanup jobs

// TTL index for automatic cleanup of expired payments (after 30 days)
CryptoPaymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export const CryptoPayment: Model<ICryptoPayment> = mongoose.model<ICryptoPayment>(
  'CryptoPayment',
  CryptoPaymentSchema
);

