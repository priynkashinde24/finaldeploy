import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Payment Split Model
 * 
 * PURPOSE:
 * - Ledger-based split payment tracking for multi-vendor marketplace
 * - One split per order (immutable after lock)
 * - Tracks supplier, reseller, and platform shares
 * - Fully auditable and idempotent
 * 
 * RULES:
 * - Amounts MUST sum exactly to totalAmount
 * - Once locked → immutable
 * - One split per order (unique constraint)
 * - Created only after payment confirmation
 */

export interface IPaymentSplit extends Document {
  storeId: mongoose.Types.ObjectId;
  orderId: string; // Order.orderId (string, not ObjectId for consistency)
  paymentId?: mongoose.Types.ObjectId; // Reference to Payment or PaymentIntent
  totalAmount: number; // Total order amount (must equal supplier + reseller + platform)

  // Supplier share
  supplierId: mongoose.Types.ObjectId;
  supplierAmount: number;

  // Reseller share
  resellerId: string; // Store ownerId (string as per Order model)
  resellerAmount: number;

  // Platform commission
  platformAmount: number;

  // Status
  status: 'pending' | 'locked' | 'settled';
  
  // Payment method
  paymentMethod: 'stripe' | 'paypal' | 'cod' | 'cod_partial' | 'crypto';

  // Metadata
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSplitSchema: Schema = new Schema(
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
      trim: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount must be non-negative'],
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      index: true,
    },
    supplierAmount: {
      type: Number,
      required: [true, 'Supplier amount is required'],
      min: [0, 'Supplier amount must be non-negative'],
    },
    resellerId: {
      type: String,
      required: [true, 'Reseller ID is required'],
      trim: true,
      index: true,
    },
    resellerAmount: {
      type: Number,
      required: [true, 'Reseller amount is required'],
      min: [0, 'Reseller amount must be non-negative'],
    },
    platformAmount: {
      type: Number,
      required: [true, 'Platform amount is required'],
      min: [0, 'Platform amount must be non-negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'locked', 'settled'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paypal', 'cod', 'cod_partial', 'crypto'],
      required: [true, 'Payment method is required'],
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

// Validate that amounts sum to totalAmount
PaymentSplitSchema.pre('save', function (next) {
  const split = this as IPaymentSplit;
  const calculatedTotal = split.supplierAmount + split.resellerAmount + split.platformAmount;
  const difference = Math.abs(calculatedTotal - split.totalAmount);
  
  if (difference > 0.01) {
    // Allow small rounding differences (1 cent)
    return next(new Error(
      `Amount mismatch: supplierAmount (${split.supplierAmount}) + resellerAmount (${split.resellerAmount}) + platformAmount (${split.platformAmount}) = ${calculatedTotal}, but totalAmount = ${split.totalAmount}`
    ));
  }
  
  next();
});

// Prevent updates after lock
PaymentSplitSchema.pre('save', function (next) {
  const split = this as IPaymentSplit;
  
  if (this.isModified() && !this.isNew) {
    if (split.status === 'locked' || split.status === 'settled') {
      // Only allow status updates from locked to settled
      const allowedFields = ['status', 'updatedAt'];
      const modifiedFields = Object.keys(this.getChanges() || {});
      const hasDisallowedChanges = modifiedFields.some(field => !allowedFields.includes(field));
      
      if (hasDisallowedChanges) {
        return next(new Error(`Cannot modify locked split. Only status can be updated from 'locked' to 'settled'.`));
      }
    }
  }
  
  next();
});

// Unique constraint: One split per order
PaymentSplitSchema.index({ orderId: 1 }, { unique: true });

// Compound indexes for common queries
PaymentSplitSchema.index({ storeId: 1, status: 1 });
PaymentSplitSchema.index({ supplierId: 1, status: 1 });
PaymentSplitSchema.index({ resellerId: 1, status: 1 });
PaymentSplitSchema.index({ storeId: 1, orderId: 1 });

export const PaymentSplit: Model<IPaymentSplit> =
  mongoose.models.PaymentSplit || mongoose.model<IPaymentSplit>('PaymentSplit', PaymentSplitSchema);

