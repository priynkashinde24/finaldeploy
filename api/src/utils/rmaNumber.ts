import mongoose from 'mongoose';
import { Store } from '../models/Store';
import { withTransaction } from './withTransaction';

/**
 * RMA Number Generator
 *
 * PURPOSE:
 * - Generate unique, sequential RMA numbers per store per year
 * - Format: RMA-{STORECODE}-{YYYY}-{SEQ}
 * - Atomic increment using MongoDB transactions
 *
 * RULES:
 * - Generated BEFORE saving RMA
 * - One sequence per store per year
 * - Thread-safe (transactional)
 */

interface RMANumberCounter {
  storeId: mongoose.Types.ObjectId;
  rmaType: 'logistics' | 'returns' | 'crm';
  year: number;
  sequence: number;
  updatedAt: Date;
}

const RMANumberCounterSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  rmaType: { type: String, enum: ['logistics', 'returns', 'crm'], required: true, index: true },
  year: { type: Number, required: true },
  sequence: { type: Number, required: true, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

// Unique constraint: One counter per store per RMA type per year
RMANumberCounterSchema.index({ storeId: 1, rmaType: 1, year: 1 }, { unique: true });

const RMANumberCounter =
  mongoose.models.RMANumberCounter ||
  mongoose.model<RMANumberCounter & mongoose.Document>('RMANumberCounter', RMANumberCounterSchema);

/**
 * Get store code from storeId
 */
async function getStoreCode(storeId: mongoose.Types.ObjectId): Promise<string> {
  const store = await Store.findById(storeId).select('code name').lean();
  if (store && store.code) {
    return store.code.toUpperCase();
  }
  // Fallback to first 4 chars of storeId if no code is set
  return storeId.toString().substring(0, 4).toUpperCase();
}

/**
 * Generate RMA number for a store
 *
 * Format: RMA-{STORECODE}-{TYPE}-{YYYY}-{SEQ}
 * Examples:
 *   Logistics: RMA-ABC-LOG-2024-0001
 *   Returns: RMA-ABC-RET-2024-0001
 *   CRM: RMA-ABC-CRM-2024-0001
 *
 * @param storeId - Store ID
 * @param rmaType - RMA type (logistics, returns, crm)
 * @param session - MongoDB ClientSession for transaction
 * @returns RMA number string
 */
export async function generateRMANumber(
  storeId: mongoose.Types.ObjectId | string,
  rmaType: 'logistics' | 'returns' | 'crm' = 'logistics',
  session: mongoose.ClientSession
): Promise<string> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const storeCode = await getStoreCode(storeObjId);
  const year = new Date().getFullYear();

  // Type prefix
  const typePrefix = {
    logistics: 'LOG',
    returns: 'RET',
    crm: 'CRM',
  }[rmaType];

  const counter = await RMANumberCounter.findOneAndUpdate(
    { storeId: storeObjId, rmaType, year },
    {
      $inc: { sequence: 1 },
      $set: { updatedAt: new Date() },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session, // Important for transaction
    }
  );

  const sequence = counter.sequence.toString().padStart(4, '0');
  const rmaNumber = `RMA-${storeCode}-${typePrefix}-${year}-${sequence}`;

  return rmaNumber;
}

