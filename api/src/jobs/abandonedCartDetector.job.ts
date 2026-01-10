import mongoose from 'mongoose';
import { Cart } from '../models/Cart';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';

/**
 * Abandoned Cart Detector Job
 *
 * PURPOSE:
 * - Detect abandoned carts reliably
 * - Mark carts as abandoned after inactivity threshold
 * - Emit events for recovery automation
 *
 * RUNS:
 * - Every 15 minutes (configurable)
 */

export interface AbandonedCartDetectorOptions {
  storeId?: mongoose.Types.ObjectId | string;
  abandonmentThresholdMinutes?: number; // Default: 30 minutes
  batchSize?: number; // Default: 100
}

export interface AbandonedCartDetectorResult {
  detectedCount: number;
  errors: string[];
  duration: number;
}

/**
 * Default abandonment threshold (30 minutes)
 */
const DEFAULT_ABANDONMENT_THRESHOLD_MINUTES = 30;

/**
 * Detect and mark abandoned carts
 */
export async function detectAbandonedCarts(
  options: AbandonedCartDetectorOptions = {}
): Promise<AbandonedCartDetectorResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: string[] = [];
  let detectedCount = 0;

  const abandonmentThresholdMinutes =
    options.abandonmentThresholdMinutes || DEFAULT_ABANDONMENT_THRESHOLD_MINUTES;
  const thresholdDate = new Date(now.getTime() - abandonmentThresholdMinutes * 60 * 1000);
  const batchSize = options.batchSize || 100;

  try {
    const storeObjId = options.storeId
      ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
      : null;

    // Find active carts that haven't been updated in threshold time
    const filter: any = {
      status: 'active',
      lastUpdatedAt: { $lt: thresholdDate },
      items: { $exists: true, $ne: [] }, // Must have items
    };

    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    // Also ensure cart has email (for guest) or userId (for authenticated)
    const emailOrUserFilter = [
      { email: { $exists: true, $ne: null, $nin: ['', null] } },
      { userId: { $exists: true, $ne: null } },
    ];
    filter.$or = emailOrUserFilter;

    const abandonedCarts = await Cart.find(filter).limit(batchSize).lean();

    console.log(
      `[ABANDONED CART DETECTOR] Found ${abandonedCarts.length} potentially abandoned carts`
    );

    // Mark each cart as abandoned
    for (const cart of abandonedCarts) {
      try {
        const cartDoc = await Cart.findById(cart._id);
        if (!cartDoc || cartDoc.status !== 'active') {
          continue; // Cart already processed or converted
        }

        // Mark as abandoned
        cartDoc.status = 'abandoned';
        cartDoc.abandonedAt = new Date();
        await cartDoc.save();

        detectedCount++;

        // Emit CART_ABANDONED event
        eventStreamEmitter.emit('event', {
          eventType: 'CART_ABANDONED',
          payload: {
            cartId: cartDoc._id.toString(),
            storeId: cartDoc.storeId.toString(),
            userId: cartDoc.userId?.toString(),
            email: cartDoc.email,
            itemCount: cartDoc.items.length,
            totalEstimate: cartDoc.totalEstimate,
          },
          storeId: cartDoc.storeId.toString(),
          userId: cartDoc.userId?.toString() || cartDoc.email,
          occurredAt: new Date(),
        });

        // Audit log
        await logAudit({
          storeId: cartDoc.storeId.toString(),
          actorRole: 'system',
          action: 'CART_ABANDONED',
          entityType: 'Cart',
          entityId: cartDoc._id.toString(),
          description: `Cart abandoned after ${abandonmentThresholdMinutes} minutes of inactivity`,
          metadata: {
            cartId: cartDoc._id.toString(),
            userId: cartDoc.userId?.toString(),
            email: cartDoc.email,
            itemCount: cartDoc.items.length,
            totalEstimate: cartDoc.totalEstimate,
            lastUpdatedAt: cartDoc.lastUpdatedAt,
            abandonedAt: cartDoc.abandonedAt,
          },
        });
      } catch (error: any) {
        console.error(`[ABANDONED CART DETECTOR] Error processing cart ${cart._id}:`, error);
        errors.push(`Failed to process cart ${cart._id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[ABANDONED CART DETECTOR] Completed: Detected ${detectedCount} abandoned carts, ` +
      `Errors: ${errors.length}, Duration: ${duration}ms`
    );

    return {
      detectedCount,
      errors,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[ABANDONED CART DETECTOR] Global error:', error);
    errors.push(`Global detection error: ${error.message}`);
    return {
      detectedCount: 0,
      errors,
      duration,
    };
  }
}

/**
 * Run detection for all stores (for global cron)
 */
export async function runGlobalAbandonedCartDetection(): Promise<AbandonedCartDetectorResult> {
  return detectAbandonedCarts({
    batchSize: 100,
  });
}

