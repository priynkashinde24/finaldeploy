import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Stripe Transfer Model
 * 
 * PURPOSE:
 * - Track Stripe transfers to supplier Connect accounts
 * - Link transfers to payouts and orders
 * - Track transfer status
 */

export interface IStripeTransfer extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  supplierId?: mongoose.Types.ObjectId; // Supplier receiving transfer (legacy)
  supplierPayoutId?: mongoose.Types.ObjectId; // Linked SupplierPayout (legacy)
  payoutLedgerId?: mongoose.Types.ObjectId; // Linked PayoutLedger (new)
  entityType?: 'supplier' | 'reseller'; // Entity type for ledger-based transfers
  entityId?: string; // Entity ID (supplier or reseller)
  orderId: string; // Order ID
  transferId: string; // Stripe Transfer ID (renamed from stripeTransferId for consistency)
  stripeTransferId?: string; // Legacy field (same as transferId)
  stripeAccountId: string; // Stripe Connect account ID
  destination: string; // Stripe Connect account ID (same as stripeAccountId)
  amount: number; // Amount in cents
  currency: string; // Currency code
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'reversed'; // Transfer status
  failureReason?: string; // Reason if transfer failed
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const StripeTransferSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      // Legacy field - optional for ledger-based transfers
    },
    supplierPayoutId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierPayout',
      default: null,
      index: true,
      // Legacy field - optional for ledger-based transfers
    },
    payoutLedgerId: {
      type: Schema.Types.ObjectId,
      ref: 'PayoutLedger',
      default: null,
      index: true,
      // New field for ledger-based transfers
    },
    entityType: {
      type: String,
      enum: ['supplier', 'reseller'],
      default: null,
      index: true,
    },
    entityId: {
      type: String,
      default: null,
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      index: true,
    },
    transferId: {
      type: String,
      required: [true, 'Transfer ID is required'],
      unique: true,
      index: true,
    },
    stripeTransferId: {
      type: String,
      default: null,
      index: true,
      // Legacy field (same as transferId)
    },
    stripeAccountId: {
      type: String,
      required: [true, 'Stripe account ID is required'],
      index: true,
    },
    destination: {
      type: String,
      required: [true, 'Destination account ID is required'],
      index: true,
      // Same as stripeAccountId
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
      enum: ['pending', 'paid', 'failed', 'canceled', 'reversed'],
      default: 'pending',
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
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

// Sync fields for backward compatibility
StripeTransferSchema.pre('save', function (next) {
  const transfer = this as IStripeTransfer;
  
  // Sync stripeTransferId with transferId
  if (transfer.transferId && !transfer.stripeTransferId) {
    transfer.stripeTransferId = transfer.transferId;
  } else if (transfer.stripeTransferId && !transfer.transferId) {
    transfer.transferId = transfer.stripeTransferId;
  }
  
  // Sync destination with stripeAccountId
  if (transfer.stripeAccountId && !transfer.destination) {
    transfer.destination = transfer.stripeAccountId;
  } else if (transfer.destination && !transfer.stripeAccountId) {
    transfer.stripeAccountId = transfer.destination;
  }
  
  next();
});

// Compound indexes
StripeTransferSchema.index({ storeId: 1, supplierId: 1, status: 1 });
StripeTransferSchema.index({ storeId: 1, orderId: 1 });
StripeTransferSchema.index({ payoutLedgerId: 1 });
StripeTransferSchema.index({ entityType: 1, entityId: 1 });

export const StripeTransfer: Model<IStripeTransfer> = mongoose.model<IStripeTransfer>(
  'StripeTransfer',
  StripeTransferSchema
);

