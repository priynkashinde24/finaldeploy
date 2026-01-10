import mongoose from 'mongoose';
import { withTransaction } from './withTransaction';

/**
 * Invoice Number Generator
 * 
 * PURPOSE:
 * - Generate unique, sequential invoice numbers
 * - Format: INV-{STORECODE}-{YYYY}-{SEQ}
 * - Atomic increment (transaction-safe)
 * - Per store per year
 */

interface InvoiceSequence {
  storeId: mongoose.Types.ObjectId;
  year: number;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSequenceSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One sequence per store per year
InvoiceSequenceSchema.index({ storeId: 1, year: 1 }, { unique: true });

const InvoiceSequenceModel =
  mongoose.models.InvoiceSequence ||
  mongoose.model<InvoiceSequence & mongoose.Document>('InvoiceSequence', InvoiceSequenceSchema);

/**
 * Get store code from storeId
 * For now, uses first 4 characters of storeId hex
 * In production, use Store.code or Store.slug
 */
async function getStoreCode(storeId: mongoose.Types.ObjectId): Promise<string> {
  // Try to get from Store model if available
  try {
    const { Store } = await import('../models/Store');
    const store = await Store.findById(storeId).select('code slug name').lean();
    
    if (store) {
      // Use store.code, store.slug, or first 4 chars of name
      return (store as any).code || (store as any).slug || (store as any).name?.substring(0, 4).toUpperCase() || 'STORE';
    }
  } catch (error) {
    // Store model not available, use fallback
  }

  // Fallback: Use first 4 characters of ObjectId hex
  return storeId.toString().substring(0, 4).toUpperCase();
}

/**
 * Generate next invoice number for a store
 * 
 * Format: INV-{STORECODE}-{YYYY}-{SEQ}
 * Example: INV-ABCD-2024-0001
 * 
 * @param storeId - Store ID
 * @returns Invoice number
 */
export async function generateInvoiceNumber(storeId: mongoose.Types.ObjectId): Promise<string> {
  const year = new Date().getFullYear();
  const storeCode = await getStoreCode(storeId);

  return await withTransaction(async (session) => {
    // Find or create sequence for this store and year
    const sequenceDoc = await InvoiceSequenceModel.findOneAndUpdate(
      {
        storeId,
        year,
      },
      {
        $inc: { sequence: 1 },
        $setOnInsert: {
          storeId,
          year,
          sequence: 0,
        },
      },
      {
        new: true,
        upsert: true,
        session,
      }
    );

    const sequence = sequenceDoc.sequence;
    const paddedSequence = String(sequence).padStart(4, '0');

    return `INV-${storeCode}-${year}-${paddedSequence}`;
  });
}

/**
 * Get current sequence number (without incrementing)
 */
export async function getCurrentSequence(
  storeId: mongoose.Types.ObjectId,
  year?: number
): Promise<number> {
  const currentYear = year || new Date().getFullYear();

  const sequenceDoc = await InvoiceSequenceModel.findOne({
    storeId,
    year: currentYear,
  });

  return sequenceDoc?.sequence || 0;
}

/**
 * Generate credit note number
 * Format: CN-{STORECODE}-{YYYY}-{SEQ}
 */
export async function generateCreditNoteNumber(storeId: mongoose.Types.ObjectId): Promise<string> {
  const year = new Date().getFullYear();
  const storeCode = await getStoreCode(storeId);

  return await withTransaction(async (session) => {
    // Use separate sequence for credit notes
    const CreditNoteSequenceModel =
      mongoose.models.CreditNoteSequence ||
      mongoose.model(
        'CreditNoteSequence',
        new mongoose.Schema(
          {
            storeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
            year: { type: Number, required: true },
            sequence: { type: Number, required: true, default: 0 },
          },
          { timestamps: true }
        )
      );

    CreditNoteSequenceModel.schema.index({ storeId: 1, year: 1 }, { unique: true });

    const sequenceDoc = await CreditNoteSequenceModel.findOneAndUpdate(
      {
        storeId,
        year,
      },
      {
        $inc: { sequence: 1 },
        $setOnInsert: {
          storeId,
          year,
          sequence: 0,
        },
      },
      {
        new: true,
        upsert: true,
        session,
      }
    );

    const sequence = sequenceDoc.sequence;
    const paddedSequence = String(sequence).padStart(4, '0');

    return `CN-${storeCode}-${year}-${paddedSequence}`;
  });
}

