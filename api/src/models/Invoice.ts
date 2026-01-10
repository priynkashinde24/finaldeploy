import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Invoice Model
 * 
 * PURPOSE:
 * - Generate legally compliant invoices
 * - Support customer, supplier, reseller, and platform invoices
 * - Immutable once issued
 * - Full audit trail
 * 
 * RULES:
 * - Invoice is immutable once issued
 * - Cancel → issue credit note (no delete)
 * - Totals must match PaymentSplit
 * - Tax snapshot frozen at generation time
 */

export interface IInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
  taxAmount?: number;
  taxType?: 'gst' | 'vat' | null;
}

export interface IInvoiceBillingInfo {
  name: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  taxId?: string; // GSTIN, VAT number, etc.
  phone?: string;
}

export interface IInvoice extends Document {
  storeId: mongoose.Types.ObjectId;
  orderId: string; // Order.orderId (string, not ObjectId)
  invoiceNumber: string; // Unique, sequential: INV-{STORECODE}-{YYYY}-{SEQ}
  invoiceType: 'customer' | 'supplier' | 'reseller' | 'platform';
  entityId: string; // supplierId / resellerId / 'platform'
  paymentSplitId?: mongoose.Types.ObjectId; // Reference to PaymentSplit

  // Billing information
  billingTo: IInvoiceBillingInfo; // Who receives the invoice
  billingFrom: IInvoiceBillingInfo; // Who issues the invoice

  // Line items
  lineItems: IInvoiceLineItem[];

  // Amounts
  subtotal: number;
  discountAmount?: number;
  taxAmount: number;
  shippingAmount?: number;
  totalAmount: number;
  currency: string;

  // Tax details (snapshot at generation time)
  taxType?: 'gst' | 'vat' | null;
  taxRate?: number;
  taxBreakdown?: {
    cgst?: number; // Central GST (for India)
    sgst?: number; // State GST (for India)
    igst?: number; // Integrated GST (for India)
    vat?: number; // VAT amount
  };

  // Payment information
  paymentMethod: 'stripe' | 'paypal' | 'cod' | 'cod_partial';
  paymentStatus: 'pending' | 'paid' | 'failed';

  // Dates
  issuedAt: Date;

  // PDF
  pdfUrl?: string;
  pdfPath?: string; // Local file path

  // Status
  status: 'issued' | 'cancelled';

  // Metadata
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema: Schema = new Schema(
  {
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity must be non-negative'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price must be non-negative'],
    },
    total: {
      type: Number,
      required: [true, 'Total is required'],
      min: [0, 'Total must be non-negative'],
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    taxAmount: {
      type: Number,
      min: 0,
    },
    taxType: {
      type: String,
      enum: ['gst', 'vat'],
      default: null,
    },
  },
  { _id: false }
);

const InvoiceBillingInfoSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
    },
    email: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    taxId: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const InvoiceSchema: Schema = new Schema(
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
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ['customer', 'supplier', 'reseller', 'platform'],
      required: [true, 'Invoice type is required'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      trim: true,
      index: true,
    },
    paymentSplitId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentSplit',
      default: null,
      index: true,
    },
    billingTo: {
      type: InvoiceBillingInfoSchema,
      required: [true, 'Billing to information is required'],
    },
    billingFrom: {
      type: InvoiceBillingInfoSchema,
      required: [true, 'Billing from information is required'],
    },
    lineItems: {
      type: [InvoiceLineItemSchema],
      required: [true, 'Line items are required'],
      validate: {
        validator: (items: IInvoiceLineItem[]) => items.length > 0,
        message: 'Invoice must have at least one line item',
      },
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal must be non-negative'],
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: [true, 'Tax amount is required'],
      min: [0, 'Tax amount must be non-negative'],
    },
    shippingAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount must be non-negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      default: 'USD',
      uppercase: true,
    },
    taxType: {
      type: String,
      enum: ['gst', 'vat'],
      default: null,
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    taxBreakdown: {
      cgst: Number,
      sgst: Number,
      igst: Number,
      vat: Number,
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paypal', 'cod', 'cod_partial'],
      required: [true, 'Payment method is required'],
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      required: [true, 'Payment status is required'],
      index: true,
    },
    issuedAt: {
      type: Date,
      required: [true, 'Issued at date is required'],
      default: Date.now,
      index: true,
    },
    pdfUrl: {
      type: String,
      trim: true,
    },
    pdfPath: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['issued', 'cancelled'],
      default: 'issued',
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

// Prevent updates after issue (except status to cancelled)
InvoiceSchema.pre('save', function (next) {
  const invoice = this as IInvoice;

  if (this.isModified() && !this.isNew) {
    if (invoice.status === 'issued') {
      // Only allow status change to cancelled
      const allowedFields = ['status', 'updatedAt'];
      const modifiedFields = Object.keys(this.getChanges() || {});
      const hasDisallowedChanges = modifiedFields.some(field => !allowedFields.includes(field));

      const newStatus = (this.getChanges() as any)?.status;
      if (hasDisallowedChanges && newStatus !== 'cancelled') {
        return next(new Error('Cannot modify issued invoice. Only status can be changed to cancelled.'));
      }
    }
  }

  next();
});

// Validate totals
InvoiceSchema.pre('save', function (next) {
  const invoice = this as IInvoice;

  // Calculate expected total
  const lineItemsTotal = invoice.lineItems.reduce((sum, item) => sum + item.total, 0);
  const expectedTotal = invoice.subtotal + invoice.taxAmount + (invoice.shippingAmount || 0) - (invoice.discountAmount || 0);

  const difference = Math.abs(expectedTotal - invoice.totalAmount);

  if (difference > 0.01) {
    return next(
      new Error(
        `Total amount mismatch: expected ${expectedTotal}, got ${invoice.totalAmount}. Subtotal: ${invoice.subtotal}, Tax: ${invoice.taxAmount}, Shipping: ${invoice.shippingAmount || 0}, Discount: ${invoice.discountAmount || 0}`
      )
    );
  }

  next();
});

// Compound indexes
InvoiceSchema.index({ storeId: 1, invoiceType: 1, status: 1 });
InvoiceSchema.index({ orderId: 1, invoiceType: 1 });
InvoiceSchema.index({ entityId: 1, invoiceType: 1 });
InvoiceSchema.index({ storeId: 1, orderId: 1 });
InvoiceSchema.index({ invoiceNumber: 1 }); // Already unique, but explicit index

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);

