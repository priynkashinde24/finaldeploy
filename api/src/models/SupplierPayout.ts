import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Supplier Payout Model
 * 
 * PURPOSE:
 * - Tracks supplier earnings from orders
 * - One payout record per order
 * - Amounts are snapshotted at order creation time (never recalculated)
 * 
 * COMMISSION CALCULATION:
 * - costAmount = costPrice * quantity (per item, then summed)
 * - payoutAmount = costAmount (supplier receives the cost price)
 * - orderAmount = total order value (sellingPrice * quantity for all items)
 * 
 * OWNERSHIP:
 * - Supplier owns this payout (supplierId)
 * - Linked to order (orderId)
 * 
 * RULES:
 * - One payout record per order per supplier
 * - Amounts are immutable after creation
 * - Payout status tracks payment processing
 */

export interface ISupplierPayout extends Document {
  supplierId: mongoose.Types.ObjectId;
  orderId: string; // Order.orderId (string, not ObjectId)
  orderAmount: number; // Total order value (sellingPrice * quantity for all items)
  costAmount: number; // Total cost (costPrice * quantity for all items)
  payoutAmount: number; // Amount to pay supplier (equals costAmount)
  payoutStatus: 'pending' | 'processed' | 'failed';
  payoutDate?: Date; // Date when payout was processed
  failureReason?: string; // Reason if payout failed
  createdAt: Date;
  updatedAt: Date;
}

const SupplierPayoutSchema: Schema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
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
    costAmount: {
      type: Number,
      required: [true, 'Cost amount is required'],
      min: [0, 'Cost amount must be non-negative'],
      // Total cost = sum of costPrice * quantity for all items
    },
    payoutAmount: {
      type: Number,
      required: [true, 'Payout amount is required'],
      min: [0, 'Payout amount must be non-negative'],
      // Amount to pay supplier (equals costAmount)
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

// Unique constraint: One payout per order per supplier
SupplierPayoutSchema.index({ supplierId: 1, orderId: 1 }, { unique: true });

// Compound indexes for common queries
SupplierPayoutSchema.index({ supplierId: 1, payoutStatus: 1 });
SupplierPayoutSchema.index({ orderId: 1 });
SupplierPayoutSchema.index({ payoutStatus: 1, createdAt: 1 });

export const SupplierPayout: Model<ISupplierPayout> =
  mongoose.models.SupplierPayout || mongoose.model<ISupplierPayout>('SupplierPayout', SupplierPayoutSchema);

