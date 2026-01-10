import mongoose from 'mongoose';
import { Store } from '../models/Store';

/**
 * Order Number Generator
 * 
 * PURPOSE:
 * - Generate unique, sequential order numbers per store per year
 * - Format: ORD-{STORECODE}-{YYYY}-{SEQ}
 * - Atomic increment using MongoDB transactions
 * 
 * RULES:
 * - Generated BEFORE saving order
 * - One sequence per store per year
 * - Thread-safe (transactional)
 */

interface OrderNumberCounter {
  storeId: mongoose.Types.ObjectId;
  year: number;
  sequence: number;
  updatedAt: Date;
}

const OrderNumberCounterSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  year: { type: Number, required: true },
  sequence: { type: Number, required: true, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

// Unique constraint: One counter per store per year
OrderNumberCounterSchema.index({ storeId: 1, year: 1 }, { unique: true });

const OrderNumberCounter =
  mongoose.models.OrderNumberCounter ||
  mongoose.model<OrderNumberCounter & mongoose.Document>('OrderNumberCounter', OrderNumberCounterSchema);

/**
 * Generate order number for a store
 * 
 * Format: ORD-{STORECODE}-{YYYY}-{SEQ}
 * Example: ORD-ABC-2024-0001
 * 
 * @param storeId - Store ID
 * @returns Order number string
 */
export async function generateOrderNumber(
  storeId: mongoose.Types.ObjectId | string
): Promise<string> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // Get store to retrieve store code
  const store = await Store.findById(storeObjId).select('storeCode name').lean();
  if (!store) {
    throw new Error(`Store not found: ${storeId}`);
  }

  // Get current year
  const year = new Date().getFullYear();

  // Get or create counter for this store + year
  const counter = await OrderNumberCounter.findOneAndUpdate(
    { storeId: storeObjId, year },
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

  // Format order number
  const storeCode = store.code || 'STORE';
  const sequence = counter.sequence.toString().padStart(4, '0');
  const orderNumber = `ORD-${storeCode.toUpperCase()}-${year}-${sequence}`;

  return orderNumber;
}

/**
 * Get next order number without incrementing (for preview)
 */
export async function previewOrderNumber(
  storeId: mongoose.Types.ObjectId | string
): Promise<string> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const store = await Store.findById(storeObjId).select('code name').lean();
  if (!store) {
    throw new Error(`Store not found: ${storeId}`);
  }

  const year = new Date().getFullYear();
  const counter = await OrderNumberCounter.findOne({ storeId: storeObjId, year }).lean();

  const currentSequence = counter && !Array.isArray(counter) ? counter.sequence : 0;
  const nextSequence = (currentSequence + 1).toString().padStart(4, '0');
  const storeCode = store.code || 'STORE';

  return `ORD-${storeCode.toUpperCase()}-${year}-${nextSequence}`;
}

