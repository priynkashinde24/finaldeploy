import mongoose from 'mongoose';
import { Store } from '../models/Store';

/**
 * Label Number Generator
 * 
 * PURPOSE:
 * - Generate unique, sequential label numbers per store per year
 * - Format: LBL-{STORECODE}-{YYYY}-{SEQ}
 * - Atomic increment using MongoDB
 * 
 * RULES:
 * - Generated at label creation
 * - One sequence per store per year
 * - Thread-safe (atomic increment)
 */

interface LabelNumberCounter {
  storeId: mongoose.Types.ObjectId;
  labelType: 'logistics' | 'returns' | 'crm';
  year: number;
  sequence: number;
  updatedAt: Date;
}

const LabelNumberCounterSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  labelType: { type: String, enum: ['logistics', 'returns', 'crm'], required: true, index: true },
  year: { type: Number, required: true },
  sequence: { type: Number, required: true, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

// Unique constraint: One counter per store per label type per year
LabelNumberCounterSchema.index({ storeId: 1, labelType: 1, year: 1 }, { unique: true });

const LabelNumberCounter =
  mongoose.models.LabelNumberCounter ||
  mongoose.model<LabelNumberCounter & mongoose.Document>('LabelNumberCounter', LabelNumberCounterSchema);

/**
 * Generate label number for a store
 * 
 * Format: LBL-{STORECODE}-{TYPE}-{YYYY}-{SEQ}
 * Examples:
 *   Logistics: LBL-ABC-LOG-2024-0001
 *   Returns: LBL-ABC-RET-2024-0001
 *   CRM: LBL-ABC-CRM-2024-0001
 * 
 * @param storeId - Store ID
 * @param labelType - Label type (logistics, returns, crm)
 * @returns Label number string
 */
export async function generateLabelNumber(
  storeId: mongoose.Types.ObjectId | string,
  labelType: 'logistics' | 'returns' | 'crm' = 'logistics'
): Promise<string> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // Get store to retrieve store code
  const store = await Store.findById(storeObjId).select('code storeCode name').lean();
  if (!store) {
    throw new Error(`Store not found: ${storeId}`);
  }

  // Get current year
  const year = new Date().getFullYear();

  // Type prefix
  const typePrefix = {
    logistics: 'LOG',
    returns: 'RET',
    crm: 'CRM',
  }[labelType];

  // Get or create counter for this store + label type + year
  const counter = await LabelNumberCounter.findOneAndUpdate(
    { storeId: storeObjId, labelType, year },
    {
      $inc: { sequence: 1 },
      $set: { updatedAt: new Date() },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  // Format label number
  const storeCode = (store as any).code || (store as any).storeCode || 'STORE';
  const sequence = counter.sequence.toString().padStart(4, '0');
  const labelNumber = `LBL-${storeCode.toUpperCase()}-${typePrefix}-${year}-${sequence}`;

  return labelNumber;
}

