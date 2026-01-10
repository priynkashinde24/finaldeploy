import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Billing Invoice Model
 * 
 * PURPOSE:
 * - Track billing invoices for subscriptions
 * - Record payment status
 * - Generate invoice numbers
 * - Ready for payment gateway integration
 * 
 * RULES:
 * - One invoice per billing period per subscription
 * - Invoice numbers are unique
 * - Invoices are immutable (read-only after creation)
 */

export interface IBillingInvoice extends Document {
  userId: mongoose.Types.ObjectId; // User (reseller or supplier)
  subscriptionId: mongoose.Types.ObjectId; // Reference to Subscription
  amount: number; // Invoice amount (₹)
  billingPeriod: {
    start: Date; // Billing period start
    end: Date; // Billing period end
  };
  invoiceNumber: string; // Unique invoice number (e.g., INV-2024-001)
  status: 'paid' | 'unpaid' | 'cancelled';
  generatedAt: Date; // When invoice was generated
  paidAt?: Date; // When invoice was paid
  paymentMethod?: string; // Payment method (if paid)
  paymentTransactionId?: string; // Payment gateway transaction ID
  notes?: string; // Admin notes
  createdAt: Date;
  updatedAt: Date;
}

const BillingInvoiceSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be non-negative'],
    },
    billingPeriod: {
      start: {
        type: Date,
        required: [true, 'Billing period start is required'],
      },
      end: {
        type: Date,
        required: [true, 'Billing period end is required'],
      },
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['paid', 'unpaid', 'cancelled'],
      default: 'unpaid',
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      maxlength: [100, 'Payment method must not exceed 100 characters'],
    },
    paymentTransactionId: {
      type: String,
      maxlength: [200, 'Transaction ID must not exceed 200 characters'],
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes must not exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
BillingInvoiceSchema.index({ userId: 1, status: 1 });
BillingInvoiceSchema.index({ subscriptionId: 1, status: 1 });
BillingInvoiceSchema.index({ generatedAt: -1 }); // For recent invoices

// Pre-save hook: Generate invoice number if not provided
BillingInvoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.models.BillingInvoice?.countDocuments({
      invoiceNumber: { $regex: `^INV-${year}-` },
    }) || 0;
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export const BillingInvoice: Model<IBillingInvoice> =
  mongoose.models.BillingInvoice || mongoose.model<IBillingInvoice>('BillingInvoice', BillingInvoiceSchema);

