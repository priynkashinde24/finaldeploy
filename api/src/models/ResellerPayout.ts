import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Reseller Payout Model
 * 
 * PURPOSE:
 * - Tracks reseller earnings from orders
 * - One payout record per order
 * - Amounts are snapshotted at order creation time (never recalculated)
 * 
 * COMMISSION CALCULATION:
 * - marginAmount = sellingPrice - costPrice (per item, then summed)
 * - payoutAmount = marginAmount (reseller keeps the margin)
 * - orderAmount = total order value (sellingPrice * quantity for all items)
 * 
 * OWNERSHIP:
 * - Reseller owns this payout (resellerId)
 * - Linked to order (orderId)
 * 
 * RULES:
 * - One payout record per order per reseller
 * - Amounts are immutable after creation
 * - Payout status tracks payment processing
 */

export interface IResellerPayout extends Document {
  resellerId: mongoose.Types.ObjectId;
  orderId: string; // Order.orderId (string, not ObjectId)
  orderAmount: number; // Total order value (sellingPrice * quantity for all items)
  marginAmount: number; // Total margin (sellingPrice - costPrice) * quantity for all items
  payoutAmount: number; // Amount to pay reseller (equals marginAmount)
  payoutStatus: 'pending' | 'processed' | 'failed';
  payoutDate?: Date; // Date when payout was processed
  failureReason?: string; // Reason if payout failed
  createdAt: Date;
  updatedAt: Date;
}

const ResellerPayoutSchema: Schema = new Schema(
  {
    resellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reseller ID is required'],
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      index: true,
    },
    orderAmount: {
      type: Number,
      required: [true, 'Order amount is required'],
      min: [0, 'Order amount must be non-negative'],
      // Total order value (sum of sellingPrice * quantity for all items)
    },
    marginAmount: {
      type: Number,
      required: [true, 'Margin amount is required'],
      min: [0, 'Margin amount must be non-negative'],
      // Total margin = sum of (sellingPrice - costPrice) * quantity for all items
    },
    payoutAmount: {
      type: Number,
      required: [true, 'Payout amount is required'],
      min: [0, 'Payout amount must be non-negative'],
      // Amount to pay reseller (equals marginAmount)
    },
    payoutStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending',
      index: true,
    },
    payoutDate: {
      type: Date,
      default: null,
      // Date when payout was processed (set when status changes to 'processed')
    },
    failureReason: {
      type: String,
      trim: true,
      default: null,
      // Reason if payout failed (set when status changes to 'failed')
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One payout per order per reseller
ResellerPayoutSchema.index({ resellerId: 1, orderId: 1 }, { unique: true });

// Compound indexes for common queries
ResellerPayoutSchema.index({ resellerId: 1, payoutStatus: 1 });
ResellerPayoutSchema.index({ orderId: 1 });
ResellerPayoutSchema.index({ payoutStatus: 1, createdAt: 1 });

export const ResellerPayout: Model<IResellerPayout> =
  mongoose.models.ResellerPayout || mongoose.model<IResellerPayout>('ResellerPayout', ResellerPayoutSchema);

