import mongoose from 'mongoose';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { Product } from '../models/Product';
import { evaluateAndCreateMarginAlert } from '../utils/marginAlertEngine';

/**
 * Margin Alerts Scheduled Job
 * 
 * PURPOSE:
 * - Scan active reseller products nightly
 * - Compute current margins
 * - Compare with markup rules & historical data
 * - Generate alerts if needed
 * 
 * RUNS:
 * - Every night (via cron or manual trigger)
 * 
 * PROCESS:
 * 1. Get all active reseller products
 * 2. For each product:
 *    - Get supplier cost
 *    - Get current selling price
 *    - Evaluate margin
 *    - Create alert if needed
 * 3. Return summary
 */

export interface MarginAlertScanOptions {
  resellerId?: string; // Optional: scan specific reseller
  limit?: number; // Optional: limit number of products to scan
  skip?: number; // Optional: pagination
}

export interface MarginAlertScanResult {
  scanned: number;
  alertsCreated: number;
  errors: string[];
  summary: {
    belowMin: number;
    nearMin: number;
    abnormallyHigh: number;
    suddenDrop: number;
  };
}

/**
 * Scan reseller products and generate margin alerts
 */
export async function scanMarginAlerts(
  options: MarginAlertScanOptions = {}
): Promise<MarginAlertScanResult> {
  const { resellerId, limit, skip = 0 } = options;

  const filter: any = {
    status: 'active',
  };
  if (resellerId) {
    filter.resellerId = new mongoose.Types.ObjectId(resellerId);
  }

  const query = ResellerProduct.find(filter).skip(skip);
  if (limit) {
    query.limit(limit);
  }

  const resellerProducts = await query.lean();

  let scanned = 0;
  let alertsCreated = 0;
  const errors: string[] = [];
  const summary = {
    belowMin: 0,
    nearMin: 0,
    abnormallyHigh: 0,
    suddenDrop: 0,
  };

  for (const resellerProduct of resellerProducts) {
    try {
      scanned++;

      // Get supplier product to get cost
      const supplierProduct = await SupplierProduct.findOne({
        supplierId: resellerProduct.supplierId,
        productId: resellerProduct.productId,
        variantId: resellerProduct.variantId || null,
        status: 'active',
      }).lean();

      if (!supplierProduct) {
        errors.push(`Supplier product not found for reseller product ${resellerProduct._id}`);
        continue;
      }

      // Get product to get category and brand
      const product = await Product.findById(resellerProduct.productId).lean();
      if (!product) {
        errors.push(`Product not found: ${resellerProduct.productId}`);
        continue;
      }

      // Evaluate margin and create alert if needed
      const result = await evaluateAndCreateMarginAlert({
        sellingPrice: resellerProduct.sellingPrice ?? 0,
        supplierCost: supplierProduct.costPrice,
        variantId: resellerProduct.variantId || null,
        productId: resellerProduct.productId,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        brandId: product.brandId as mongoose.Types.ObjectId | null,
        resellerId: resellerProduct.resellerId.toString(),
        appliesTo: 'reseller',
        scope: resellerProduct.variantId ? 'variant' : 'product',
        scopeId: resellerProduct.variantId || resellerProduct.productId,
      });

      if (result.created) {
        alertsCreated++;
        if (result.evaluation.alertType) {
          switch (result.evaluation.alertType) {
            case 'below_min_markup':
              summary.belowMin++;
              break;
            case 'near_min_markup':
              summary.nearMin++;
              break;
            case 'abnormally_high_markup':
              summary.abnormallyHigh++;
              break;
            case 'sudden_margin_drop':
              summary.suddenDrop++;
              break;
          }
        }
      }
    } catch (error: any) {
      errors.push(`Error processing reseller product ${resellerProduct._id}: ${error.message}`);
      console.error('[MARGIN ALERT JOB] Error:', error);
    }
  }

  console.log(`[MARGIN ALERT JOB] Scanned ${scanned} products, created ${alertsCreated} alerts`);

  return {
    scanned,
    alertsCreated,
    errors,
    summary,
  };
}

/**
 * Scan all active reseller products (for nightly cron job)
 */
export async function scanAllMarginAlerts(): Promise<MarginAlertScanResult> {
  const totalProducts = await ResellerProduct.countDocuments({ status: 'active' });
  const batchSize = 100; // Process in batches to avoid memory issues
  let totalScanned = 0;
  let totalAlertsCreated = 0;
  const allErrors: string[] = [];
  const totalSummary = {
    belowMin: 0,
    nearMin: 0,
    abnormallyHigh: 0,
    suddenDrop: 0,
  };

  for (let skip = 0; skip < totalProducts; skip += batchSize) {
    const result = await scanMarginAlerts({
      limit: batchSize,
      skip,
    });

    totalScanned += result.scanned;
    totalAlertsCreated += result.alertsCreated;
    allErrors.push(...result.errors);
    totalSummary.belowMin += result.summary.belowMin;
    totalSummary.nearMin += result.summary.nearMin;
    totalSummary.abnormallyHigh += result.summary.abnormallyHigh;
    totalSummary.suddenDrop += result.summary.suddenDrop;
  }

  console.log(
    `[MARGIN ALERT JOB] Completed: Scanned ${totalScanned} products, created ${totalAlertsCreated} alerts`
  );

  return {
    scanned: totalScanned,
    alertsCreated: totalAlertsCreated,
    errors: allErrors,
    summary: totalSummary,
  };
}

