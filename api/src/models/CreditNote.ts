import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Credit Note Model
 * 
 * PURPOSE:
 * - Issue credit notes for refunds/returns
 * - Linked to original invoice
 * - Negative amounts
 * - Immutable once issued
 * 
 * RULES:
 * - Linked to original invoice
 * - Negative amounts
 * - Immutable once issued
 * - Used for refunds and partial returns
 */

export interface ICreditNote extends Document {
  storeId: mongoose.Types.ObjectId;
  orderId: string; // Order.orderId
  invoiceId: mongoose.Types.ObjectId; // Reference to original Invoice
  creditNoteNumber: string; // Unique, sequential: CN-{STORECODE}-{YYYY}-{SEQ}
  invoiceType: 'customer' | 'supplier' | 'reseller' | 'platform'; // Same as original invoice
  entityId: string; // Same as original invoice

  // Amounts (negative)
  subtotal: number; // Negative
  taxAmount: number; // Negative
  totalAmount: number; // Negative (total refund amount)

  // Reason
  reason: string; // Refund reason, return reason, etc.

  // Dates
  issuedAt: Date;

  // PDF
  pdfUrl?: string;
  pdfPath?: string;

  // Status
  status: 'issued' | 'cancelled';

  // Metadata
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const CreditNoteSchema: Schema = new Schema(
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
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Invoice ID is required'],
      index: true,
    },
    creditNoteNumber: {
      type: String,
      required: [true, 'Credit note number is required'],
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
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      // Can be negative for credit notes
    },
    taxAmount: {
      type: Number,
      required: [true, 'Tax amount is required'],
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      // Should be negative for credit notes
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
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
CreditNoteSchema.pre('save', function (next) {
  const creditNote = this as ICreditNote;

  if (this.isModified() && !this.isNew) {
    if (creditNote.status === 'issued') {
      // Only allow status change to cancelled
      const allowedFields = ['status', 'updatedAt'];
      const modifiedFields = Object.keys(this.getChanges() || {});
      const hasDisallowedChanges = modifiedFields.some(field => !allowedFields.includes(field));

      const newStatus = (this.getChanges() as any)?.status;
      if (hasDisallowedChanges && newStatus !== 'cancelled') {
        return next(new Error('Cannot modify issued credit note. Only status can be changed to cancelled.'));
      }
    }
  }

  next();
});

// Compound indexes
CreditNoteSchema.index({ storeId: 1, invoiceType: 1, status: 1 });
CreditNoteSchema.index({ orderId: 1, invoiceType: 1 });
CreditNoteSchema.index({ invoiceId: 1 });
CreditNoteSchema.index({ storeId: 1, orderId: 1 });

export const CreditNote: Model<ICreditNote> =
  mongoose.models.CreditNote || mongoose.model<ICreditNote>('CreditNote', CreditNoteSchema);

