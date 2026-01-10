import mongoose from 'mongoose';
import { syncAllVariants, syncSupplier, syncVariant } from '../services/inventorySync.service';

/**
 * Inventory Sync Background Job
 * 
 * PURPOSE:
 * - Sync supplier variant inventory to reseller views
 * - Run periodically to keep data fresh
 * - Only sync deltas (efficient)
 * - No heavy locks
 * 
 * RUNS:
 * - Every X minutes (configurable via environment variable)
 * - Can be triggered manually
 */

export interface InventorySyncJobOptions {
  storeId?: mongoose.Types.ObjectId | string;
  supplierId?: mongoose.Types.ObjectId | string;
  globalVariantId?: mongoose.Types.ObjectId | string;
  batchSize?: number;
}

export interface InventorySyncJobResult {
  success: boolean;
  variantsSynced: number;
  resellerInventoriesUpdated: number;
  resellerProductsDisabled: number;
  resellerProductsEnabled: number;
  errors: string[];
  duration: number; // milliseconds
}

/**
 * Run inventory sync job
 */
export async function runInventorySyncJob(
  options: InventorySyncJobOptions = {}
): Promise<InventorySyncJobResult> {
  const startTime = Date.now();

  try {
    let result;

    if (options.globalVariantId) {
      // Sync single variant
      const syncResult = await syncVariant(options.globalVariantId, options);
      result = {
        success: syncResult.success,
        variantsSynced: syncResult.synced ? 1 : 0,
        resellerInventoriesUpdated: syncResult.resellerInventoriesUpdated,
        resellerProductsDisabled: syncResult.resellerProductsDisabled,
        resellerProductsEnabled: syncResult.resellerProductsEnabled,
        errors: syncResult.error ? [syncResult.error] : [],
      };
    } else if (options.supplierId) {
      // Sync by supplier
      result = await syncSupplier(options.supplierId, options);
    } else {
      // Sync all variants
      result = await syncAllVariants(options);
    }

    const duration = Date.now() - startTime;

    console.log(
      `[INVENTORY SYNC JOB] Completed: Variants synced ${result.variantsSynced}, ` +
      `Reseller inventories updated ${result.resellerInventoriesUpdated}, ` +
      `Products disabled ${result.resellerProductsDisabled}, ` +
      `Products enabled ${result.resellerProductsEnabled}, ` +
      `Errors: ${result.errors.length}, Duration: ${duration}ms`
    );

    return {
      ...result,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[INVENTORY SYNC JOB] Failed:', error);

    return {
      success: false,
      variantsSynced: 0,
      resellerInventoriesUpdated: 0,
      resellerProductsDisabled: 0,
      resellerProductsEnabled: 0,
      errors: [error.message || 'Unknown error'],
      duration,
    };
  }
}

/**
 * Run inventory sync job for all stores (for global cron)
 */
export async function runGlobalInventorySyncJob(): Promise<InventorySyncJobResult> {
  return runInventorySyncJob({
    batchSize: 100, // Process in batches to avoid memory issues
  });
}

