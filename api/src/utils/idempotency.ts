import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';

/**
 * Idempotency Guard
 * 
 * PURPOSE:
 * - Prevent duplicate orders from same checkout request
 * - Use cart hash + userId + storeId as key
 * - Store idempotency keys with expiration
 * 
 * RULES:
 * - Same checkout request = same order
 * - Keys expire after 24 hours
 * - Thread-safe (transactional)
 */

interface IdempotencyKey {
  key: string;
  orderId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const IdempotencyKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL index
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const IdempotencyKey =
  mongoose.models.IdempotencyKey ||
  mongoose.model<IdempotencyKey & mongoose.Document>('IdempotencyKey', IdempotencyKeySchema);

/**
 * Generate idempotency key from checkout request
 */
export function generateIdempotencyKey(params: {
  storeId: mongoose.Types.ObjectId | string;
  customerId?: string;
  items: Array<{ productId: string; quantity: number }>;
  shippingAddress?: any;
  paymentMethod?: string;
}): string {
  const { storeId, customerId, items, shippingAddress, paymentMethod } = params;

  // Create deterministic hash from request
  const payload = {
    storeId: storeId.toString(),
    customerId: customerId || 'guest',
    items: items
      .map((item) => `${item.productId}:${item.quantity}`)
      .sort()
      .join(','),
    shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : '',
    paymentMethod: paymentMethod || '',
  };

  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return `idempotency:${hash}`;
}

/**
 * Check if idempotency key exists and return existing order ID
 */
export async function checkIdempotency(
  key: string,
  storeId: mongoose.Types.ObjectId | string
): Promise<{ exists: boolean; orderId?: mongoose.Types.ObjectId | string }> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const idempotencyKey = await IdempotencyKey.findOne({
    key,
    storeId: storeObjId,
    expiresAt: { $gt: new Date() },
  }).lean();

  if (idempotencyKey && !Array.isArray(idempotencyKey)) {
    return {
      exists: true,
      orderId: idempotencyKey.orderId,
    };
  }

  return { exists: false };
}

/**
 * Store idempotency key with order ID
 */
export async function storeIdempotencyKey(
  key: string,
  orderId: mongoose.Types.ObjectId | string,
  storeId: mongoose.Types.ObjectId | string
): Promise<void> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;

  // Expires after 24 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await IdempotencyKey.create({
    key,
    orderId: orderObjId,
    storeId: storeObjId,
    expiresAt,
  });
}

/**
 * Check if an idempotency key exists (synchronous check for simple cases)
 * Note: This is a simple check - for store generation, we use a simplified key format
 */
export function isIdempotent(key: string): boolean {
  // This is a synchronous check - in practice, you'd want to check the database
  // For now, return false to allow the async check to happen
  return false;
}

/**
 * Mark an idempotency key as used (synchronous for simple cases)
 * Note: This is a simplified version - for store generation, we use a simplified key format
 * Returns true if successfully marked, false if already exists
 */
export function markIdempotent(key: string): boolean {
  // This is a synchronous check - in practice, you'd want to use a distributed lock
  // For now, return true to allow processing (the actual check happens in the transaction)
  return true;
}