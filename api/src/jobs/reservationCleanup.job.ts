import mongoose from 'mongoose';
import { Reservation } from '../models/Reservation';
import { releaseReservation } from '../services/reservation.service';

/**
 * Reservation Cleanup Job
 * 
 * PURPOSE:
 * - Release expired reservations automatically
 * - Clean up stale reservation data
 * - Prevent inventory from being locked indefinitely
 * 
 * RUNS:
 * - Every X minutes (configurable via environment variable)
 * - Can be triggered manually
 */

export interface ReservationCleanupOptions {
  storeId?: mongoose.Types.ObjectId | string;
  batchSize?: number;
  maxAgeMinutes?: number; // Default: 15 minutes
}

export interface ReservationCleanupResult {
  success: boolean;
  expired: number;
  released: number;
  errors: string[];
  duration: number; // milliseconds
}

/**
 * Release expired reservations
 */
export async function cleanupExpiredReservations(
  options: ReservationCleanupOptions = {}
): Promise<ReservationCleanupResult> {
  const startTime = Date.now();
  const result: ReservationCleanupResult = {
    success: true,
    expired: 0,
    released: 0,
    errors: [],
    duration: 0,
  };

  try {
    const maxAgeMinutes = options.maxAgeMinutes || 15;
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - maxAgeMinutes);

    const filter: any = {
      status: 'reserved',
      expiresAt: { $lt: new Date() }, // Expired
    };

    if (options.storeId) {
      filter.storeId = typeof options.storeId === 'string'
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
    }

    const batchSize = options.batchSize || 100;
    const expiredReservations = await Reservation.find(filter)
      .limit(batchSize)
      .lean();

    result.expired = expiredReservations.length;

    for (const reservation of expiredReservations) {
      try {
        const releaseResult = await releaseReservation(
          reservation._id,
          'expired',
          options
        );

        if (releaseResult.success) {
          result.released++;
        } else {
          result.errors.push(`Reservation ${reservation._id}: ${releaseResult.error}`);
        }
      } catch (error: any) {
        result.errors.push(`Reservation ${reservation._id}: ${error.message}`);
      }
    }

    result.duration = Date.now() - startTime;
    result.success = result.errors.length === 0;

    console.log(
      `[RESERVATION CLEANUP] Completed: Found ${result.expired} expired, ` +
      `Released ${result.released}, Errors: ${result.errors.length}, Duration: ${result.duration}ms`
    );

    return result;
  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message || 'Cleanup failed');
    result.duration = Date.now() - startTime;
    console.error('[RESERVATION CLEANUP] Failed:', error);
    return result;
  }
}

/**
 * Run cleanup for all stores (for global cron)
 */
export async function runGlobalReservationCleanup(): Promise<ReservationCleanupResult> {
  return cleanupExpiredReservations({
    batchSize: 100,
    maxAgeMinutes: 15,
  });
}

