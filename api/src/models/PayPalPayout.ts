import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * PayPal Payout Model
 * 
 * PURPOSE:
 * - Track PayPal payouts to suppliers
 * - Link to supplier payouts
 * - Store PayPal batch IDs
 */

export interface IPayPalPayout extends Document {
  storeId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  supplierPayoutId: mongoose.Types.ObjectId;
  orderId: string;
  paypalBatchId: string; // PayPal batch payout ID
  amount: number; // Amount in cents
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PayPalPayoutSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    supplierPayoutId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierPayout',
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    paypalBatchId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'canceled'],
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

PayPalPayoutSchema.index({ storeId: 1, supplierId: 1, status: 1 });
PayPalPayoutSchema.index({ paypalBatchId: 1 });

export const PayPalPayout: Model<IPayPalPayout> = mongoose.model<IPayPalPayout>(
  'PayPalPayout',
  PayPalPayoutSchema
);

