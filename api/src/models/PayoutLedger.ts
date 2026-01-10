import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Payout Ledger Model
 * 
 * PURPOSE:
 * - Track what is owed to suppliers, resellers, and platform
 * - Decouple payment from payout
 * - Support delayed payouts with eligibility rules
 * - Append-only ledger (never update, only add entries)
 * 
 * RULES:
 * - One ledger entry per entity per order
 * - Ledger is append-only
 * - Negative entries for refunds/reversals
 * - availableAt determines when payout becomes eligible
 */

export interface IPayoutLedger extends Document {
  storeId: mongoose.Types.ObjectId;
  entityType: 'supplier' | 'reseller' | 'platform';
  entityId: string; // Supplier ID, Reseller ID, or 'platform'
  orderId: string; // Order.orderId (string, not ObjectId)
  paymentSplitId?: mongoose.Types.ObjectId; // Reference to PaymentSplit
  amount: number; // Amount owed (can be negative for refunds)
  status: 'pending' | 'eligible' | 'paid';
  availableAt: Date; // When payout becomes eligible (now + settlementDelay)
  paidAt?: Date; // When payout was executed
  payoutReference?: string; // External payout reference (Stripe transfer ID, PayPal payout ID, etc.)
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutLedgerSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    entityType: {
      type: String,
      enum: ['supplier', 'reseller', 'platform'],
      required: [true, 'Entity type is required'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      trim: true,
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      trim: true,
      index: true,
    },
    paymentSplitId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentSplit',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      // Can be negative for refunds/reversals
    },
    status: {
      type: String,
      enum: ['pending', 'eligible', 'paid'],
      default: 'pending',
      index: true,
    },
    availableAt: {
      type: Date,
      required: [true, 'Available at date is required'],
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    payoutReference: {
      type: String,
      trim: true,
      default: null,
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

// Compound indexes for common queries
PayoutLedgerSchema.index({ storeId: 1, entityType: 1, status: 1 });
PayoutLedgerSchema.index({ entityId: 1, status: 1 });
PayoutLedgerSchema.index({ orderId: 1, entityType: 1 });
PayoutLedgerSchema.index({ storeId: 1, orderId: 1 });
PayoutLedgerSchema.index({ availableAt: 1, status: 1 }); // For eligibility queries

export const PayoutLedger: Model<IPayoutLedger> =
  mongoose.models.PayoutLedger || mongoose.model<IPayoutLedger>('PayoutLedger', PayoutLedgerSchema);
