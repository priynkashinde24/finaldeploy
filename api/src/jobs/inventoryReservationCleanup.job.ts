import mongoose from 'mongoose';
import { InventoryReservation } from '../models/InventoryReservation';
import { releaseInventory } from '../services/inventoryReservation.service';

/**
 * Inventory Reservation Cleanup Job
 * 
 * PURPOSE:
 * - Release expired inventory reservations
 * - Prevents stale reservations from holding up inventory
 * - Runs periodically via cron
 * 
 * RUNS:
 * - Every 5 minutes (configurable)
 */

export interface InventoryReservationCleanupResult {
  cleanedCount: number;
  errors: string[];
  duration: number;
}

/**
 * Cleanup expired inventory reservations
 */
export async function cleanupExpiredInventoryReservations(
  options: { storeId?: mongoose.Types.ObjectId | string; batchSize?: number } = {}
): Promise<InventoryReservationCleanupResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: string[] = [];
  let cleanedCount = 0;

  try {
    const storeObjId = options.storeId
      ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
      : null;

    const filter: any = {
      status: 'reserved',
      expiresAt: { $lte: now },
    };
    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    const batchSize = options.batchSize || 100;
    const expiredReservations = await InventoryReservation.find(filter)
      .limit(batchSize)
      .lean();

    console.log(
      `[INVENTORY RESERVATION CLEANUP] Found ${expiredReservations.length} expired reservations`
    );

    // Release each expired reservation
    for (const reservation of expiredReservations) {
      try {
        const releaseResult = await releaseInventory(reservation.orderId, {
          storeId: reservation.storeId.toString(),
          reason: 'expired',
        });

        if (releaseResult.success) {
          cleanedCount++;
        } else {
          errors.push(`Failed to release reservation ${reservation._id}: ${releaseResult.error}`);
        }
      } catch (error: any) {
        console.error(
          `[INVENTORY RESERVATION CLEANUP] Error releasing reservation ${reservation._id}:`,
          error
        );
        errors.push(`Failed to release reservation ${reservation._id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[INVENTORY RESERVATION CLEANUP] Completed: Cleaned ${cleanedCount} expired reservations, ` +
      `Errors: ${errors.length}, Duration: ${duration}ms`
    );

    return {
      cleanedCount,
      errors,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[INVENTORY RESERVATION CLEANUP] Global error:', error);
    errors.push(`Global cleanup error: ${error.message}`);
    return {
      cleanedCount: 0,
      errors,
      duration,
    };
  }
}

/**
 * Run cleanup for all stores (for global cron)
 */
export async function runGlobalInventoryReservationCleanup(): Promise<InventoryReservationCleanupResult> {
  return cleanupExpiredInventoryReservations({
    batchSize: 100,
  });
}

