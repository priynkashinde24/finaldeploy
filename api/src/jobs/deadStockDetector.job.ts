import mongoose from 'mongoose';
import { DeadStockRule } from '../models/DeadStockRule';
import { DeadStockAlert } from '../models/DeadStockAlert';
import { SKUHeatmapSnapshot } from '../models/SKUHeatmapSnapshot';
import { InventoryAgingSnapshot } from '../models/InventoryAgingSnapshot';
import { Order } from '../models/Order';
import { ProductVariant } from '../models/ProductVariant';
import { SupplierProduct } from '../models/SupplierProduct';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';
import { generateDiscountProposal } from '../services/autoDiscountEngine';

/**
 * Dead Stock Detector Job
 * 
 * PURPOSE:
 * - Detect SKUs with low or no sales movement
 * - Create or update dead stock alerts
 * - Resolve alerts when SKUs recover
 * 
 * RUNS:
 * - Daily (off-peak hours)
 * 
 * LOGIC:
 * 1. Load active DeadStockRules
 * 2. For each SKU in scope:
 *    - Fetch latest SKUHeatmapSnapshot
 *    - Fetch inventory stockLevel
 *    - Calculate daysSinceLastSale
 * 3. Evaluate rules
 * 4. Create or update alerts
 * 5. Resolve alerts if SKU recovered
 */

export interface DeadStockDetectionOptions {
  storeId?: mongoose.Types.ObjectId | string;
  scope?: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;
  force?: boolean;
}

export interface DeadStockDetectionResult {
  success: boolean;
  alertsCreated: number;
  alertsUpdated: number;
  alertsResolved: number;
  errors: string[];
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get last sale date for a SKU from orders
 */
async function getLastSaleDate(
  storeId: mongoose.Types.ObjectId,
  skuId: mongoose.Types.ObjectId,
  scope: 'admin' | 'supplier' | 'reseller',
  entityId?: mongoose.Types.ObjectId | string | null
): Promise<Date | null> {
  const query: any = {
    storeId,
    orderStatus: { $in: ['confirmed', 'delivered'] },
    'items.globalVariantId': skuId,
  };

  // Scope-based filtering
  if (scope === 'reseller' && entityId) {
    query.resellerId = entityId.toString();
  } else if (scope === 'supplier' && entityId) {
    // For supplier, we need to check if any item in the order was supplied by this supplier
    query['items.supplierId'] = entityId;
  }

  const lastOrder = await Order.findOne(query)
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();

  return lastOrder?.createdAt || null;
}

/**
 * Calculate sales velocity (units per day) for a SKU
 */
async function calculateSalesVelocity(
  storeId: mongoose.Types.ObjectId,
  skuId: mongoose.Types.ObjectId,
  scope: 'admin' | 'supplier' | 'reseller',
  entityId?: mongoose.Types.ObjectId | string | null,
  days: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const query: any = {
    storeId,
    orderStatus: { $in: ['confirmed', 'delivered'] },
    createdAt: { $gte: cutoffDate },
    'items.globalVariantId': skuId,
  };

  if (scope === 'reseller' && entityId) {
    query.resellerId = entityId.toString();
  } else if (scope === 'supplier' && entityId) {
    query['items.supplierId'] = entityId;
  }

  const orders = await Order.find(query).lean();
  let totalQuantity = 0;

  for (const order of orders) {
    for (const item of order.items) {
      if (item.globalVariantId?.toString() === skuId.toString()) {
        totalQuantity += item.quantity || 0;
      }
    }
  }

  return totalQuantity / days;
}

/**
 * Generate action suggestions for a dead stock alert
 */
function generateSuggestions(
  daysSinceLastSale: number,
  stockLevel: number,
  stockValue: number
): {
  discountPercent?: number;
  bundleWith?: mongoose.Types.ObjectId[];
  liquidation?: boolean;
  supplierReturn?: boolean;
  delist?: boolean;
} {
  const suggestions: {
    discountPercent?: number;
    bundleWith?: mongoose.Types.ObjectId[];
    liquidation?: boolean;
    supplierReturn?: boolean;
    delist?: boolean;
  } = {};

  // Suggest discount based on age
  if (daysSinceLastSale > 60) {
    suggestions.discountPercent = Math.min(50, 20 + Math.floor(daysSinceLastSale / 10));
  } else if (daysSinceLastSale > 30) {
    suggestions.discountPercent = 15;
  }

  // Suggest liquidation for very old stock
  if (daysSinceLastSale > 90 && stockValue > 1000) {
    suggestions.liquidation = true;
  }

  // Suggest delisting for very old stock with low value
  if (daysSinceLastSale > 120 && stockValue < 500) {
    suggestions.delist = true;
  }

  // Suggest supplier return for high-value dead stock (if allowed)
  if (daysSinceLastSale > 90 && stockValue > 2000) {
    suggestions.supplierReturn = true;
  }

  return suggestions;
}

/**
 * Evaluate if a SKU matches dead stock rules
 */
function evaluateDeadStock(
  rule: any,
  stockLevel: number,
  daysSinceLastSale: number,
  salesVelocity?: number
): { matches: boolean; severity: 'warning' | 'critical' } {
  // Must have stock
  if (stockLevel < rule.minStockThreshold) {
    return { matches: false, severity: 'warning' };
  }

  // Check days without sales
  if (daysSinceLastSale < rule.daysWithoutSales) {
    return { matches: false, severity: 'warning' };
  }

  // Check velocity threshold if set
  if (rule.velocityThreshold !== null && rule.velocityThreshold !== undefined) {
    if (salesVelocity !== undefined && salesVelocity >= rule.velocityThreshold) {
      return { matches: false, severity: 'warning' };
    }
  }

  // Determine severity
  let severity: 'warning' | 'critical' = rule.severity;
  if (daysSinceLastSale > rule.daysWithoutSales * 2) {
    severity = 'critical';
  }

  return { matches: true, severity };
}

/**
 * Process dead stock detection for a single store and scope
 */
async function processDeadStockDetection(
  storeId: mongoose.Types.ObjectId,
  scope: 'admin' | 'supplier' | 'reseller',
  entityId?: mongoose.Types.ObjectId | string | null
): Promise<{ created: number; updated: number; resolved: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let resolved = 0;
  const errors: string[] = [];

  try {
    // Get active rule for this scope
    const ruleQuery: any = {
      storeId,
      scope,
      isActive: true,
    };

    if (entityId !== null && entityId !== undefined) {
      ruleQuery.entityId = entityId;
    } else {
      ruleQuery.entityId = null;
    }

    const rule = await DeadStockRule.findOne(ruleQuery).lean();
    if (!rule) {
      return { created: 0, updated: 0, resolved: 0, errors: ['No active rule found for this scope'] };
    }

    // Get today's date and yesterday's date (fallback)
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

    // Get latest SKU heatmap snapshots (try today first, fallback to yesterday)
    const snapshotQuery: any = {
      storeId,
      scope,
      date: { $in: [today, yesterday] },
    };

    if (entityId !== null && entityId !== undefined) {
      snapshotQuery.entityId = entityId;
    } else {
      snapshotQuery.entityId = null;
    }

    const allSnapshots = await SKUHeatmapSnapshot.find(snapshotQuery)
      .sort({ date: -1 })
      .lean();

    // Group by SKU and take the most recent snapshot for each
    const snapshotMap = new Map<string, any>();
    for (const snapshot of allSnapshots) {
      const key = snapshot.skuId.toString();
      if (!snapshotMap.has(key) || snapshot.date === today) {
        snapshotMap.set(key, snapshot);
      }
    }

    const snapshots = Array.from(snapshotMap.values());
    
    console.log(`[DEAD STOCK DETECTOR] Processing ${snapshots.length} SKUs for store ${storeId}, scope ${scope}, entity ${entityId || 'null'}`);

    // Batch fetch supplier products for cost prices (performance optimization)
    const skuIds = snapshots.map((s) => s.skuId);
    const supplierProducts = await SupplierProduct.find({
      storeId,
      variantId: { $in: skuIds },
      status: 'active',
    })
      .select('variantId costPrice')
      .lean();
    
    // Map variantId to cost price (use first supplier's cost price if multiple)
    const costPriceMap = new Map<string, number>();
    for (const sp of supplierProducts) {
      const variantIdStr = sp.variantId?.toString();
      if (variantIdStr && !costPriceMap.has(variantIdStr)) {
        costPriceMap.set(variantIdStr, sp.costPrice || 0);
      }
    }

    // Process each SKU
    let processed = 0;
    for (const snapshot of snapshots) {
      try {
        processed++;
        if (processed % 100 === 0) {
          console.log(`[DEAD STOCK DETECTOR] Processed ${processed}/${snapshots.length} SKUs...`);
        }

        const skuId = snapshot.skuId;
        const stockLevel = snapshot.stockLevel || 0;

        // Get last sale date
        const lastSoldAt = await getLastSaleDate(storeId, skuId, scope, entityId);
        const daysSinceLastSale = lastSoldAt
          ? Math.floor((Date.now() - lastSoldAt.getTime()) / (1000 * 60 * 60 * 24))
          : 999; // Never sold

        // Calculate sales velocity
        const salesVelocity = await calculateSalesVelocity(storeId, skuId, scope, entityId, 30);

        // Evaluate rule
        const evaluation = evaluateDeadStock(rule, stockLevel, daysSinceLastSale, salesVelocity);

        // Get cost price from supplier product (from batch-fetched map)
        const costPrice = costPriceMap.get(skuId.toString()) || 0;
        const stockValue = stockLevel * costPrice;

        // Check if alert already exists
        const alertQuery: any = {
          storeId,
          scope,
          skuId,
          status: { $in: ['open', 'acknowledged'] },
        };

        if (entityId !== null && entityId !== undefined) {
          alertQuery.entityId = entityId;
        } else {
          alertQuery.entityId = null;
        }

        const existingAlert = await DeadStockAlert.findOne(alertQuery).lean();

        if (evaluation.matches) {
          // SKU matches dead stock criteria
          const suggestions = generateSuggestions(daysSinceLastSale, stockLevel, stockValue);

          if (existingAlert) {
            // Update existing alert if severity changed
            if (existingAlert.severity !== evaluation.severity) {
              await DeadStockAlert.updateOne(
                { _id: existingAlert._id },
                {
                  $set: {
                    severity: evaluation.severity,
                    stockLevel,
                    stockValue,
                    lastSoldAt,
                    daysSinceLastSale,
                    salesVelocity,
                    suggestions,
                  },
                }
              );
              updated++;
            }
          } else {
            // Create new alert
            const newAlert = await DeadStockAlert.create({
              storeId,
              scope,
              entityId: entityId || null,
              skuId,
              sku: snapshot.sku || 'UNKNOWN',
              productId: snapshot.productId,
              severity: evaluation.severity,
              status: 'open',
              stockLevel,
              stockValue,
              lastSoldAt,
              daysSinceLastSale,
              salesVelocity,
              ruleId: rule._id,
              suggestions,
            });
            created++;

            // Log audit
            await logAudit({
              action: 'DEAD_STOCK_ALERT_CREATED',
              actorId: null,
              actorRole: 'system',
              entityType: 'DeadStockAlert',
              entityId: skuId.toString(),
              storeId: storeId.toString(),
              description: `Dead stock alert created for SKU ${snapshot.sku || skuId.toString()} (${evaluation.severity})`,
              metadata: {
                scope,
                entityId: entityId?.toString() || null,
                severity: evaluation.severity,
                daysSinceLastSale,
                stockLevel,
              },
            });

            // Emit event for notification system (in-app, email, WhatsApp)
            // This allows listeners to send notifications without blocking the job
            eventStreamEmitter.emit('event', {
              eventType: 'DEAD_STOCK_ALERT_CREATED',
              payload: {
                alertId: newAlert._id.toString(),
                storeId: storeId.toString(),
                skuId: skuId.toString(),
                sku: snapshot.sku || 'UNKNOWN',
                severity: evaluation.severity,
                scope,
                entityId: entityId?.toString() || null,
                stockLevel,
                stockValue,
                daysSinceLastSale,
              },
              timestamp: new Date(),
            });

            // Generate discount proposal if rule exists (non-blocking)
            generateDiscountProposal({
              storeId,
              scope,
              entityId,
              alertId: newAlert._id,
            }).catch((error) => {
              // Silently fail - proposal generation shouldn't block alert creation
              console.error(`[DEAD STOCK DETECTOR] Failed to generate discount proposal for alert ${newAlert._id}:`, error.message);
            });
          }
        } else {
          // SKU doesn't match criteria - resolve existing alert if any
          if (existingAlert) {
            await DeadStockAlert.updateOne(
              { _id: existingAlert._id },
              {
                $set: {
                  status: 'resolved',
                  resolvedAt: new Date(),
                  resolvedBy: 'system',
                  resolutionReason: 'SKU recovered - sales detected or stock depleted',
                },
              }
            );
            resolved++;

            // Log audit
            await logAudit({
              action: 'DEAD_STOCK_ALERT_RESOLVED',
              actorId: null,
              actorRole: 'system',
              entityType: 'DeadStockAlert',
              entityId: existingAlert._id.toString(),
              storeId: storeId.toString(),
              description: `Dead stock alert auto-resolved: SKU recovered`,
              metadata: {
                scope,
                entityId: entityId?.toString() || null,
                reason: 'SKU recovered',
              },
            });
          }
        }
      } catch (error: any) {
        errors.push(`Error processing SKU ${snapshot.skuId}: ${error.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`Error in processDeadStockDetection: ${error.message}`);
  }

  console.log(
    `[DEAD STOCK DETECTOR] Completed for store ${storeId}, scope ${scope}, entity ${entityId || 'null'}: ` +
    `${created} created, ${updated} updated, ${resolved} resolved, ${errors.length} errors`
  );

  return { created, updated, resolved, errors };
}

/**
 * Run dead stock detection for all stores
 */
export async function runDeadStockDetection(
  options: DeadStockDetectionOptions = {}
): Promise<DeadStockDetectionResult> {
  const startTime = Date.now();
  console.log('[DEAD STOCK DETECTOR] Starting dead stock detection job...');

  const result: DeadStockDetectionResult = {
    success: true,
    alertsCreated: 0,
    alertsUpdated: 0,
    alertsResolved: 0,
    errors: [],
  };

  try {
    // If storeId is provided, process only that store
    if (options.storeId) {
      const storeId = typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId;
      const scope = options.scope || 'admin';
      const entityId = options.entityId;

      const processResult = await processDeadStockDetection(storeId, scope, entityId);
      result.alertsCreated += processResult.created;
      result.alertsUpdated += processResult.updated;
      result.alertsResolved += processResult.resolved;
      result.errors.push(...processResult.errors);
    } else {
      // Process all stores (get from rules)
      const rules = await DeadStockRule.find({ isActive: true }).distinct('storeId').lean();
      const storeIds = rules.map((id) => new mongoose.Types.ObjectId(id.toString()));

      for (const storeId of storeIds) {
        // Process admin scope
        const adminResult = await processDeadStockDetection(storeId, 'admin', null);
        result.alertsCreated += adminResult.created;
        result.alertsUpdated += adminResult.updated;
        result.alertsResolved += adminResult.resolved;
        result.errors.push(...adminResult.errors);

        // Process supplier scopes (get all supplier rules for this store)
        const supplierRules = await DeadStockRule.find({
          storeId,
          scope: 'supplier',
          isActive: true,
        })
          .select('entityId')
          .lean();

        for (const supplierRule of supplierRules) {
          const supplierResult = await processDeadStockDetection(storeId, 'supplier', supplierRule.entityId);
          result.alertsCreated += supplierResult.created;
          result.alertsUpdated += supplierResult.updated;
          result.alertsResolved += supplierResult.resolved;
          result.errors.push(...supplierResult.errors);
        }

        // Process reseller scopes (get all reseller rules for this store)
        const resellerRules = await DeadStockRule.find({
          storeId,
          scope: 'reseller',
          isActive: true,
        })
          .select('entityId')
          .lean();

        for (const resellerRule of resellerRules) {
          const resellerResult = await processDeadStockDetection(storeId, 'reseller', resellerRule.entityId);
          result.alertsCreated += resellerResult.created;
          result.alertsUpdated += resellerResult.updated;
          result.alertsResolved += resellerResult.resolved;
          result.errors.push(...resellerResult.errors);
        }
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[DEAD STOCK DETECTOR] Job completed in ${duration}s: ` +
      `${result.alertsCreated} created, ${result.alertsUpdated} updated, ` +
      `${result.alertsResolved} resolved, ${result.errors.length} errors`
    );
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Fatal error: ${error.message}`);
    console.error('[DEAD STOCK DETECTOR] Fatal error:', error);
  }

  return result;
}

