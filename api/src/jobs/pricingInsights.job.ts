import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { PricingInsight } from '../models/PricingInsight';
import { aggregatePricingMetrics } from '../utils/pricingDataAggregator';
import { generatePricingSuggestion } from '../utils/pricingSuggestionEngine';

/**
 * Pricing Insights Generation Job
 * 
 * PURPOSE:
 * - Generate pricing insights for products and variants
 * - Run nightly (or manually triggered)
 * - Create snapshot of pricing suggestions
 * 
 * PROCESS:
 * 1. Loop through active products/variants
 * 2. Aggregate pricing metrics
 * 3. Generate suggestions
 * 4. Save insights (expire old ones)
 */

export interface InsightGenerationOptions {
  scope?: 'product' | 'variant' | 'all'; // What to generate insights for
  scopeId?: string; // Specific product/variant ID
  resellerId?: string; // Optional: filter by reseller
  days?: number; // Number of days to look back (default: 30)
  expireOldInsights?: boolean; // Whether to expire old insights (default: true)
}

/**
 * Generate insight for a specific scope (product or variant)
 */
export async function generateInsightForScope(
  scope: 'product' | 'variant',
  scopeId: mongoose.Types.ObjectId,
  options: { resellerId?: string; days?: number } = {}
): Promise<any> {
  try {
    // Get product/variant info
    let productId: mongoose.Types.ObjectId;
    let variantId: mongoose.Types.ObjectId | null = null;
    let categoryId: mongoose.Types.ObjectId | null = null;

    if (scope === 'product') {
      const product = await Product.findById(scopeId).lean();
      if (!product) {
        return null;
      }
      productId = scopeId;
      categoryId = product.categoryId as mongoose.Types.ObjectId;
    } else {
      const variant = await ProductVariant.findById(scopeId).lean();
      if (!variant) {
        return null;
      }
      variantId = scopeId;
      productId = variant.productId as mongoose.Types.ObjectId;
      const product = await Product.findById(productId).lean();
      if (product) {
        categoryId = product.categoryId as mongoose.Types.ObjectId;
      }
    }

    // Aggregate pricing metrics
    const metrics = await aggregatePricingMetrics({
      scope,
      scopeId,
      resellerId: options.resellerId,
      days: options.days || 30,
    });

    if (!metrics) {
      return null;
    }

    // Need at least some data to generate insight
    if (metrics.currentSellingPrice === 0 || metrics.costPrice === 0) {
      return null;
    }

    // Generate pricing suggestion
    const suggestion = await generatePricingSuggestion({
      currentPrice: metrics.currentSellingPrice,
      costPrice: metrics.costPrice,
      stockLevel: metrics.stockLevel,
      avgDailyOrders: metrics.avgDailyOrders,
      stockVelocity: metrics.stockVelocity,
      avgMargin: metrics.avgMargin,
      priceElasticityScore: metrics.priceElasticityScore,
      productId,
      variantId,
      categoryId,
    });

    // Expire old insights for this scope
    await PricingInsight.updateMany(
      {
        scope,
        scopeId,
        expiresAt: { $gte: new Date() }, // Only active ones
      },
      {
        $set: {
          expiresAt: new Date(), // Expire immediately
        },
      }
    );

    // Create new insight
    const insight = new PricingInsight({
      scope,
      scopeId,
      currentPrice: metrics.currentSellingPrice,
      suggestedPrice: suggestion.suggestedPrice,
      suggestionReason: suggestion.reason,
      confidenceScore: suggestion.confidenceScore,
      metricsSnapshot: {
        avgDailyOrders: metrics.avgDailyOrders,
        stockLevel: metrics.stockLevel,
        stockVelocity: metrics.stockVelocity,
        avgMargin: metrics.avgMargin,
        priceElasticityScore: metrics.priceElasticityScore,
        conversionRate: metrics.conversionRate,
        competitorPrice: undefined, // Not available yet
      },
      expectedImpact: suggestion.expectedImpact,
      adminConstraints: suggestion.adminConstraints,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    await insight.save();

    return insight;
  } catch (error) {
    console.error(`[PRICING INSIGHTS] Error generating insight for ${scope} ${scopeId}:`, error);
    return null;
  }
}

/**
 * Generate insights for all active products
 */
export async function generateInsightsForAllProducts(options: InsightGenerationOptions = {}): Promise<{
  generated: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let generated = 0;
  let failed = 0;

  try {
    // Get all active products
    const products = await Product.find({ status: 'active' }).lean();

    for (const product of products) {
      try {
        // Check if product has active reseller products
        const resellerProducts = await ResellerProduct.find({
          productId: product._id,
          status: 'active',
        }).lean();

        if (resellerProducts.length === 0) {
          continue; // Skip products with no active reseller listings
        }

        // Generate insight for product
        const insight = await generateInsightForScope('product', product._id as mongoose.Types.ObjectId, {
          resellerId: options.resellerId,
          days: options.days,
        });

        if (insight) {
          generated++;
        } else {
          failed++;
        }
      } catch (error: any) {
        errors.push(`Product ${product._id}: ${error.message}`);
        failed++;
      }
    }

    return { generated, failed, errors };
  } catch (error: any) {
    errors.push(`Fatal error: ${error.message}`);
    return { generated, failed, errors };
  }
}

/**
 * Generate insights for all active variants
 */
export async function generateInsightsForAllVariants(options: InsightGenerationOptions = {}): Promise<{
  generated: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let generated = 0;
  let failed = 0;

  try {
    // Get all active variants
    const variants = await ProductVariant.find({ status: 'active' }).lean();

    for (const variant of variants) {
      try {
        // Check if variant has active reseller products
        const resellerProducts = await ResellerProduct.find({
          variantId: variant._id,
          status: 'active',
        }).lean();

        if (resellerProducts.length === 0) {
          continue; // Skip variants with no active reseller listings
        }

        // Generate insight for variant
        const insight = await generateInsightForScope('variant', variant._id as mongoose.Types.ObjectId, {
          resellerId: options.resellerId,
          days: options.days,
        });

        if (insight) {
          generated++;
        } else {
          failed++;
        }
      } catch (error: any) {
        errors.push(`Variant ${variant._id}: ${error.message}`);
        failed++;
      }
    }

    return { generated, failed, errors };
  } catch (error: any) {
    errors.push(`Fatal error: ${error.message}`);
    return { generated, failed, errors };
  }
}

/**
 * Main job function - generates insights for all products and variants
 */
export async function generateAllPricingInsights(options: InsightGenerationOptions = {}): Promise<{
  products: { generated: number; failed: number; errors: string[] };
  variants: { generated: number; failed: number; errors: string[] };
  totalGenerated: number;
  totalFailed: number;
}> {
  console.log('[PRICING INSIGHTS] Starting insight generation job...');

  let productsResult = { generated: 0, failed: 0, errors: [] as string[] };
  let variantsResult = { generated: 0, failed: 0, errors: [] as string[] };

  if (options.scope === 'product' || options.scope === 'all' || !options.scope) {
    console.log('[PRICING INSIGHTS] Generating insights for products...');
    productsResult = await generateInsightsForAllProducts(options);
    console.log(`[PRICING INSIGHTS] Products: ${productsResult.generated} generated, ${productsResult.failed} failed`);
  }

  if (options.scope === 'variant' || options.scope === 'all' || !options.scope) {
    console.log('[PRICING INSIGHTS] Generating insights for variants...');
    variantsResult = await generateInsightsForAllVariants(options);
    console.log(`[PRICING INSIGHTS] Variants: ${variantsResult.generated} generated, ${variantsResult.failed} failed`);
  }

  const totalGenerated = productsResult.generated + variantsResult.generated;
  const totalFailed = productsResult.failed + variantsResult.failed;

  console.log(`[PRICING INSIGHTS] Job completed: ${totalGenerated} generated, ${totalFailed} failed`);

  return {
    products: productsResult,
    variants: variantsResult,
    totalGenerated,
    totalFailed,
  };
}

/**
 * Clean up expired insights (optional maintenance job)
 */
export async function cleanupExpiredInsights(): Promise<number> {
  const result = await PricingInsight.deleteMany({
    expiresAt: { $lt: new Date() },
  });

  console.log(`[PRICING INSIGHTS] Cleaned up ${result.deletedCount} expired insights`);
  return result.deletedCount || 0;
}

