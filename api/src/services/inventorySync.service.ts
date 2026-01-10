import mongoose, { ClientSession } from 'mongoose';
import { SupplierVariantInventory } from '../models/SupplierVariantInventory';
import { ResellerVariantInventory } from '../models/ResellerVariantInventory';
import { ResellerProduct } from '../models/ResellerProduct';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';

/**
 * Inventory Sync Service
 * 
 * PURPOSE:
 * - Sync supplier variant inventory to reseller views
 * - Auto-disable reseller listings if stock = 0
 * - Auto-enable when stock returns
 * - Only sync deltas (efficient)
 */

export interface SyncVariantResult {
  success: boolean;
  synced: boolean;
  resellerInventoriesUpdated: number;
  resellerProductsDisabled: number;
  resellerProductsEnabled: number;
  error?: string;
}

export interface SyncSupplierResult {
  success: boolean;
  variantsSynced: number;
  resellerInventoriesUpdated: number;
  resellerProductsDisabled: number;
  resellerProductsEnabled: number;
  errors: string[];
}

/**
 * Sync a single variant from supplier to all resellers
 */
export async function syncVariant(
  globalVariantId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<SyncVariantResult> {
  try {
    const variantObjId = typeof globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(globalVariantId)
      : globalVariantId;
    const storeObjId = options.storeId
      ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
      : null;

    const filter: any = { globalVariantId: variantObjId };
    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    // Get all supplier inventories for this variant
    const supplierInventories = await SupplierVariantInventory.find(filter).lean();

    if (supplierInventories.length === 0) {
      return {
        success: true,
        synced: false,
        resellerInventoriesUpdated: 0,
        resellerProductsDisabled: 0,
        resellerProductsEnabled: 0,
      };
    }

    let resellerInventoriesUpdated = 0;
    let resellerProductsDisabled = 0;
    let resellerProductsEnabled = 0;

    // For each supplier inventory, sync to reseller inventories
    for (const supplierInventory of supplierInventories) {
      // Find all reseller products that use this supplier + variant
      const resellerProducts = await ResellerProduct.find({
        storeId: supplierInventory.storeId,
        supplierId: supplierInventory.supplierId,
        globalVariantId: variantObjId,
      }).lean();

      // Update or create reseller variant inventory for each reseller
      for (const resellerProduct of resellerProducts) {
        const oldInventory = await ResellerVariantInventory.findOne({
          storeId: supplierInventory.storeId,
          resellerId: resellerProduct.resellerId,
          supplierId: supplierInventory.supplierId,
          globalVariantId: variantObjId,
        });

        const newStock = supplierInventory.availableStock;
        const wasSellable = oldInventory?.isSellable || false;
        const isSellable = newStock > 0;

        // Update or create reseller inventory
        await ResellerVariantInventory.findOneAndUpdate(
          {
            storeId: supplierInventory.storeId,
            resellerId: resellerProduct.resellerId,
            supplierId: supplierInventory.supplierId,
            globalVariantId: variantObjId,
          },
          {
            $set: {
              storeId: supplierInventory.storeId,
              resellerId: resellerProduct.resellerId,
              supplierId: supplierInventory.supplierId,
              globalVariantId: variantObjId,
              syncedStock: newStock,
              isSellable,
              lastSyncedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );

        resellerInventoriesUpdated++;

        // Auto-disable/enable reseller product based on stock
        if (wasSellable && !isSellable) {
          // Stock went to 0, disable reseller product
          await ResellerProduct.findByIdAndUpdate(resellerProduct._id, {
            isActive: false,
            status: 'inactive',
          });
          resellerProductsDisabled++;

          // Audit log
          await logAudit({
            storeId: supplierInventory.storeId.toString(),
            actorRole: 'system',
            action: 'RESELLER_PRODUCT_DEACTIVATED',
            entityType: 'ResellerProduct',
            entityId: resellerProduct._id.toString(),
            before: { isActive: true, status: 'active' },
            after: { isActive: false, status: 'inactive', reason: 'Variant out of stock' },
            description: `Reseller product deactivated due to variant stock = 0`,
          });

          // Emit event
          eventStreamEmitter.emit('event', {
            eventType: 'INVENTORY_OUT_OF_STOCK',
            payload: {
              variantId: variantObjId.toString(),
              resellerProductId: resellerProduct._id.toString(),
              supplierId: supplierInventory.supplierId.toString(),
            },
            storeId: supplierInventory.storeId.toString(),
            occurredAt: new Date(),
          });
        } else if (!wasSellable && isSellable) {
          // Stock returned, enable reseller product
          await ResellerProduct.findByIdAndUpdate(resellerProduct._id, {
            isActive: true,
            status: 'active',
          });
          resellerProductsEnabled++;

          // Audit log
          await logAudit({
            storeId: supplierInventory.storeId.toString(),
            actorRole: 'system',
            action: 'RESELLER_PRODUCT_ACTIVATED',
            entityType: 'ResellerProduct',
            entityId: resellerProduct._id.toString(),
            before: { isActive: false, status: 'inactive' },
            after: { isActive: true, status: 'active', reason: 'Variant stock restored' },
            description: `Reseller product activated due to variant stock restored`,
          });
        }
      }
    }

    // Emit sync event
    if (storeObjId) {
      eventStreamEmitter.emit('event', {
        eventType: 'INVENTORY_SYNCED',
        payload: {
          variantId: variantObjId.toString(),
          resellerInventoriesUpdated,
          resellerProductsDisabled,
          resellerProductsEnabled,
        },
        storeId: storeObjId.toString(),
        occurredAt: new Date(),
      });
    }

    return {
      success: true,
      synced: true,
      resellerInventoriesUpdated,
      resellerProductsDisabled,
      resellerProductsEnabled,
    };
  } catch (error: any) {
    return {
      success: false,
      synced: false,
      resellerInventoriesUpdated: 0,
      resellerProductsDisabled: 0,
      resellerProductsEnabled: 0,
      error: error.message || 'Sync failed',
    };
  }
}

/**
 * Sync all variants for a supplier
 */
export async function syncSupplier(
  supplierId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string; batchSize?: number } = {}
): Promise<SyncSupplierResult> {
  const result: SyncSupplierResult = {
    success: true,
    variantsSynced: 0,
    resellerInventoriesUpdated: 0,
    resellerProductsDisabled: 0,
    resellerProductsEnabled: 0,
    errors: [],
  };

  try {
    const supplierObjId = typeof supplierId === 'string'
      ? new mongoose.Types.ObjectId(supplierId)
      : supplierId;
    const storeObjId = options.storeId
      ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
      : null;

    const filter: any = { supplierId: supplierObjId };
    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    const batchSize = options.batchSize || 100;
    const supplierInventories = await SupplierVariantInventory.find(filter)
      .limit(batchSize)
      .lean();

    // Group by variant to avoid duplicate syncs
    const variantMap = new Map<string, typeof supplierInventories[0]>();
    for (const inventory of supplierInventories) {
      const variantKey = inventory.globalVariantId.toString();
      if (!variantMap.has(variantKey)) {
        variantMap.set(variantKey, inventory);
      }
    }

    // Sync each unique variant
    for (const inventory of variantMap.values()) {
      const syncResult = await syncVariant(inventory.globalVariantId, options);
      if (syncResult.success) {
        result.variantsSynced++;
        result.resellerInventoriesUpdated += syncResult.resellerInventoriesUpdated;
        result.resellerProductsDisabled += syncResult.resellerProductsDisabled;
        result.resellerProductsEnabled += syncResult.resellerProductsEnabled;
      } else {
        result.errors.push(`Variant ${inventory.globalVariantId}: ${syncResult.error}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message || 'Sync failed');
    return result;
  }
}

/**
 * Sync all variants (for background job)
 */
export async function syncAllVariants(
  options: { storeId?: mongoose.Types.ObjectId | string; batchSize?: number } = {}
): Promise<SyncSupplierResult> {
  const result: SyncSupplierResult = {
    success: true,
    variantsSynced: 0,
    resellerInventoriesUpdated: 0,
    resellerProductsDisabled: 0,
    resellerProductsEnabled: 0,
    errors: [],
  };

  try {
    const storeObjId = options.storeId
      ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
      : null;

    const filter: any = {};
    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    const batchSize = options.batchSize || 100;
    const totalInventories = await SupplierVariantInventory.countDocuments(filter);

    // Process in batches
    for (let skip = 0; skip < totalInventories; skip += batchSize) {
      const inventories = await SupplierVariantInventory.find(filter)
        .skip(skip)
        .limit(batchSize)
        .lean();

      // Group by variant
      const variantMap = new Map<string, typeof inventories[0]>();
      for (const inventory of inventories) {
        const variantKey = inventory.globalVariantId.toString();
        if (!variantMap.has(variantKey)) {
          variantMap.set(variantKey, inventory);
        }
      }

      // Sync each unique variant
      for (const inventory of variantMap.values()) {
        const syncResult = await syncVariant(inventory.globalVariantId, options);
        if (syncResult.success) {
          result.variantsSynced++;
          result.resellerInventoriesUpdated += syncResult.resellerInventoriesUpdated;
          result.resellerProductsDisabled += syncResult.resellerProductsDisabled;
          result.resellerProductsEnabled += syncResult.resellerProductsEnabled;
        } else {
          result.errors.push(`Variant ${inventory.globalVariantId}: ${syncResult.error}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message || 'Sync failed');
    return result;
  }
}

