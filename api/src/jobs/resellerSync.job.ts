import mongoose from 'mongoose';
import { syncAllResellerProducts, syncBySupplier } from '../services/resellerSync.service';

/**
 * Reseller Sync Background Job
 * 
 * PURPOSE:
 * - Run periodically to sync stock, cost, and status from supplier
 * - Update syncedStock & supplierCost
 * - Handle out-of-stock scenarios
 * - Detect margin violations
 * 
 * RUNS:
 * - Every X minutes (configurable via environment variable)
 * - Can be triggered manually
 */

export interface ResellerSyncJobOptions {
  storeId?: mongoose.Types.ObjectId | string;
  supplierId?: mongoose.Types.ObjectId | string;
  batchSize?: number;
}

export interface ResellerSyncJobResult {
  success: boolean;
  synced: number;
  updated: number;
  deactivated: number;
  reactivated: number;
  marginViolations: number;
  errors: string[];
  duration: number; // milliseconds
}

/**
 * Run reseller sync job
 */
export async function runResellerSyncJob(
  options: ResellerSyncJobOptions = {}
): Promise<ResellerSyncJobResult> {
  const startTime = Date.now();

  try {
    let result;

    if (options.supplierId) {
      // Sync by specific supplier
      result = await syncBySupplier(options.supplierId, {
        storeId: options.storeId,
        limit: options.batchSize || 1000,
      });
    } else {
      // Sync all reseller products
      result = await syncAllResellerProducts({
        storeId: options.storeId,
        batchSize: options.batchSize || 100,
      });
    }

    const duration = Date.now() - startTime;

    console.log(
      `[RESELLER SYNC JOB] Completed: Synced ${result.synced} products, ` +
      `Updated ${result.updated}, Deactivated ${result.deactivated}, ` +
      `Reactivated ${result.reactivated}, Margin violations: ${result.marginViolations}, ` +
      `Errors: ${result.errors.length}, Duration: ${duration}ms`
    );

    return {
      success: result.errors.length === 0,
      ...result,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[RESELLER SYNC JOB] Failed:', error);

    return {
      success: false,
      synced: 0,
      updated: 0,
      deactivated: 0,
      reactivated: 0,
      marginViolations: 0,
      errors: [error.message || 'Unknown error'],
      duration,
    };
  }
}

/**
 * Run reseller sync job for all stores (for global cron)
 */
export async function runGlobalResellerSyncJob(): Promise<ResellerSyncJobResult> {
  return runResellerSyncJob({
    batchSize: 100, // Process in batches to avoid memory issues
  });
}

