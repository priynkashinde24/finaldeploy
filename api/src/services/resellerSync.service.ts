import mongoose from 'mongoose';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { evaluateAndCreateMarginAlert } from '../utils/marginAlertEngine';
import { Product } from '../models/Product';
import { logAudit } from '../utils/auditLogger';

/**
 * Reseller Sync Service
 * 
 * PURPOSE:
 * - Sync stock, cost, and status from supplier to reseller products
 * - Update syncedStock and supplierCost
 * - DO NOT change reseller price
 * - Flag reseller product if cost increases cause margin violation
 * - Handle out-of-stock scenarios
 */

export interface SyncResult {
  synced: number;
  updated: number;
  deactivated: number;
  reactivated: number;
  marginViolations: number;
  errors: string[];
}

/**
 * Sync a single reseller product variant
 */
export async function syncSingleVariant(
  resellerProductId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<{ success: boolean; error?: string; marginViolation?: boolean }> {
  try {
    const resellerProduct = await ResellerProduct.findById(resellerProductId);
    if (!resellerProduct) {
      return { success: false, error: 'Reseller product not found' };
    }

    // Apply store filter if provided
    if (options.storeId) {
      const storeId = typeof options.storeId === 'string' 
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
      if (resellerProduct.storeId.toString() !== storeId.toString()) {
        return { success: false, error: 'Store ID mismatch' };
      }
    }

    // Get supplier product
    const supplierProduct = await SupplierProduct.findById(resellerProduct.supplierProductId);
    if (!supplierProduct) {
      return { success: false, error: 'Supplier product not found' };
    }

    // Check if supplier product is still active
    if (supplierProduct.status !== 'active') {
      // Deactivate reseller product
      const wasActive = resellerProduct.isActive;
      resellerProduct.isActive = false;
      resellerProduct.status = 'inactive';
      resellerProduct.syncedStock = 0;
      resellerProduct.lastSyncedAt = new Date();
      await resellerProduct.save();

      if (wasActive) {
        // Audit log
        await logAudit({
          storeId: resellerProduct.storeId.toString(),
          actorRole: 'system',
          action: 'RESELLER_PRODUCT_DEACTIVATED',
          entityType: 'ResellerProduct',
          entityId: resellerProduct._id,
          before: { isActive: true, status: 'active' },
          after: { isActive: false, status: 'inactive', reason: 'Supplier product inactive' },
          description: 'Reseller product deactivated due to supplier product being inactive',
        });
      }

      return { success: true };
    }

    // Sync stock and cost
    const oldStock = resellerProduct.syncedStock;
    const oldCost = resellerProduct.supplierCost;
    const newStock = supplierProduct.stockQuantity;
    const newCost = supplierProduct.costPrice;

    resellerProduct.syncedStock = newStock;
    resellerProduct.supplierCost = newCost;
    resellerProduct.lastSyncedAt = new Date();

    // Handle out-of-stock: deactivate if stock = 0
    const wasActive = resellerProduct.isActive;
    if (newStock === 0) {
      resellerProduct.isActive = false;
      resellerProduct.status = 'inactive';
    } else if (newStock > 0 && !wasActive) {
      // Re-activate if stock returns
      resellerProduct.isActive = true;
      resellerProduct.status = 'active';
    }

    await resellerProduct.save();

    // Check for margin violation if cost increased
    let marginViolation = false;
    if (newCost > oldCost) {
      const currentMargin = ((resellerProduct.resellerPrice - newCost) / newCost) * 100;
      
      // Get product for markup validation
      const product = await Product.findById(resellerProduct.globalProductId);
      if (product) {
        const { validateMarkupRule } = await import('../utils/markupEngine');
        const validation = await validateMarkupRule({
          variantId: resellerProduct.globalVariantId || null,
          productId: resellerProduct.globalProductId,
          categoryId: product.categoryId as mongoose.Types.ObjectId,
          brandId: product.brandId as mongoose.Types.ObjectId | null,
          supplierCost: newCost,
          appliesTo: 'reseller',
          proposedSellingPrice: resellerProduct.resellerPrice,
        });

        if (!validation.valid) {
          marginViolation = true;
          
          // Create margin alert
          await evaluateAndCreateMarginAlert({
            sellingPrice: resellerProduct.resellerPrice,
            supplierCost: newCost,
            variantId: resellerProduct.globalVariantId || null,
            productId: resellerProduct.globalProductId,
            categoryId: product.categoryId as mongoose.Types.ObjectId,
            brandId: product.brandId as mongoose.Types.ObjectId | null,
            resellerId: resellerProduct.resellerId.toString(),
            appliesTo: 'reseller',
            scope: resellerProduct.globalVariantId ? 'variant' : 'product',
            scopeId: resellerProduct.globalVariantId || resellerProduct.globalProductId,
          }).catch((error) => {
            console.error('[MARGIN ALERT] Failed to create alert:', error);
          });

          // Audit log
          await logAudit({
            storeId: resellerProduct.storeId.toString(),
            actorRole: 'system',
            action: 'MARGIN_VIOLATION_DETECTED',
            entityType: 'ResellerProduct',
            entityId: resellerProduct._id,
            before: { supplierCost: oldCost, margin: ((resellerProduct.resellerPrice - oldCost) / oldCost) * 100 },
            after: { supplierCost: newCost, margin: currentMargin },
            description: `Margin violation detected after supplier cost increase`,
            metadata: {
              resellerId: resellerProduct.resellerId.toString(),
              supplierProductId: supplierProduct._id.toString(),
            },
          });
        }
      }
    }

    // Audit log for sync
    if (oldStock !== newStock || oldCost !== newCost || wasActive !== resellerProduct.isActive) {
      await logAudit({
        storeId: resellerProduct.storeId.toString(),
        actorRole: 'system',
        action: 'RESELLER_PRODUCT_SYNCED',
        entityType: 'ResellerProduct',
        entityId: resellerProduct._id,
        before: {
          syncedStock: oldStock,
          supplierCost: oldCost,
          isActive: wasActive,
        },
        after: {
          syncedStock: newStock,
          supplierCost: newCost,
          isActive: resellerProduct.isActive,
        },
        description: `Reseller product synced from supplier`,
        metadata: {
          resellerId: resellerProduct.resellerId.toString(),
          supplierProductId: supplierProduct._id.toString(),
          marginViolation,
        },
      });
    }

    return { success: true, marginViolation };
  } catch (error: any) {
    return { success: false, error: error.message || 'Sync failed' };
  }
}

/**
 * Sync all reseller products for a specific supplier
 */
export async function syncBySupplier(
  supplierId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string; limit?: number; skip?: number } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    updated: 0,
    deactivated: 0,
    reactivated: 0,
    marginViolations: 0,
    errors: [],
  };

  try {
    const supplierObjId = typeof supplierId === 'string' 
      ? new mongoose.Types.ObjectId(supplierId)
      : supplierId;

    const filter: any = {
      supplierId: supplierObjId,
    };

    if (options.storeId) {
      filter.storeId = typeof options.storeId === 'string'
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
    }

    const resellerProducts = await ResellerProduct.find(filter)
      .limit(options.limit || 1000)
      .skip(options.skip || 0)
      .lean();

    for (const rp of resellerProducts) {
      const syncResult = await syncSingleVariant(rp._id, options);
      result.synced++;

      if (syncResult.success) {
        // Check what changed by comparing with original
        const updated = await ResellerProduct.findById(rp._id);
        if (updated) {
          if (updated.syncedStock !== rp.syncedStock || updated.supplierCost !== (rp as any).supplierCost) {
            result.updated++;
          }
          if (!updated.isActive && (rp as any).isActive) {
            result.deactivated++;
          }
          if (updated.isActive && !(rp as any).isActive) {
            result.reactivated++;
          }
        }
        if (syncResult.marginViolation) {
          result.marginViolations++;
        }
      } else {
        result.errors.push(`Product ${rp._id}: ${syncResult.error}`);
      }
    }
  } catch (error: any) {
    result.errors.push(`Sync failed: ${error.message}`);
  }

  return result;
}

/**
 * Sync all reseller products (for background job)
 */
export async function syncAllResellerProducts(
  options: { storeId?: mongoose.Types.ObjectId | string; batchSize?: number } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    updated: 0,
    deactivated: 0,
    reactivated: 0,
    marginViolations: 0,
    errors: [],
  };

  try {
    const filter: any = {};
    if (options.storeId) {
      filter.storeId = typeof options.storeId === 'string'
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
    }

    const batchSize = options.batchSize || 100;
    const totalProducts = await ResellerProduct.countDocuments(filter);
    
    for (let skip = 0; skip < totalProducts; skip += batchSize) {
      const resellerProducts = await ResellerProduct.find(filter)
        .skip(skip)
        .limit(batchSize)
        .lean();

      for (const rp of resellerProducts) {
        const syncResult = await syncSingleVariant(rp._id, options);
        result.synced++;

        if (syncResult.success) {
          const updated = await ResellerProduct.findById(rp._id);
          if (updated) {
            if (updated.syncedStock !== rp.syncedStock || updated.supplierCost !== (rp as any).supplierCost) {
              result.updated++;
            }
            if (!updated.isActive && (rp as any).isActive) {
              result.deactivated++;
            }
            if (updated.isActive && !(rp as any).isActive) {
              result.reactivated++;
            }
          }
          if (syncResult.marginViolation) {
            result.marginViolations++;
          }
        } else {
          result.errors.push(`Product ${rp._id}: ${syncResult.error}`);
        }
      }
    }
  } catch (error: any) {
    result.errors.push(`Sync failed: ${error.message}`);
  }

  return result;
}

