import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { SupplierProduct } from '../models/SupplierProduct';
import { ResellerProduct } from '../models/ResellerProduct';

/**
 * Pricing Data Aggregator Utility
 * 
 * PURPOSE:
 * - Aggregate sales, demand, stock, and margin data
 * - Compute metrics for pricing insights
 * - Provide data inputs for suggestion engine
 * 
 * METRICS COMPUTED:
 * - Average daily orders (last 7/30 days)
 * - Stock velocity (days of stock remaining)
 * - Average margin percentage
 * - Price vs conversion trend
 */

export interface PricingMetrics {
  avgDailyOrders: number; // Average daily orders (last 7/30 days)
  stockLevel: number; // Current stock level
  stockVelocity: number; // Days of stock remaining at current sales rate
  avgMargin: number; // Average margin percentage
  priceElasticityScore: number; // Price sensitivity score (0-100)
  conversionRate?: number; // Conversion rate if available
  totalOrders: number; // Total orders in period
  totalQuantitySold: number; // Total quantity sold in period
  avgSellingPrice: number; // Average selling price in period
  costPrice: number; // Current cost price
  currentSellingPrice: number; // Current selling price
}

export interface PricingDataParams {
  scope: 'product' | 'variant';
  scopeId: mongoose.Types.ObjectId | string;
  resellerId?: mongoose.Types.ObjectId | string; // Optional: filter by reseller
  days: number; // Number of days to look back (default: 30)
}

/**
 * Aggregate pricing metrics for a product or variant
 */
export async function aggregatePricingMetrics(
  params: PricingDataParams
): Promise<PricingMetrics | null> {
  const { scope, scopeId, resellerId, days = 30 } = params;

  const scopeObjId = new mongoose.Types.ObjectId(scopeId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Find orders with this product/variant in the specified period
  // Only count paid orders
  const orders = await Order.find({
    status: 'paid',
    createdAt: { $gte: cutoffDate },
    ...(resellerId ? { resellerId: resellerId.toString() } : {}),
  }).lean();

  // Aggregate order items for this product/variant
  let totalQuantitySold = 0;
  let totalOrders = 0;
  let totalRevenue = 0;
  const prices: number[] = [];

  for (const order of orders) {
    for (const item of order.items) {
      // Match by productId (for product scope) or need to check variant
      if (item.productId === scopeId.toString()) {
        totalQuantitySold += item.quantity;
        totalRevenue += item.totalPrice;
        prices.push(item.unitPrice);
        totalOrders++;
      }
    }
  }

  // Calculate average daily orders
  const avgDailyOrders = totalQuantitySold / days;

  // Get current stock level and cost price from SupplierProduct
  let stockLevel = 0;
  let costPrice = 0;
  let currentSellingPrice = 0;

  if (scope === 'variant') {
    // For variant, find SupplierProduct with variantId
    const supplierProduct = await SupplierProduct.findOne({
      variantId: scopeObjId,
      status: 'active',
    }).lean();

    if (supplierProduct) {
      stockLevel = supplierProduct.stockQuantity || 0;
      costPrice = supplierProduct.costPrice || 0;
    }

    // Get current selling price from ResellerProduct
    const resellerProduct = await ResellerProduct.findOne({
      variantId: scopeObjId,
      status: 'active',
      ...(resellerId ? { resellerId: new mongoose.Types.ObjectId(resellerId) } : {}),
    }).lean();

    if (resellerProduct) {
      currentSellingPrice = resellerProduct.sellingPrice || 0;
    }
  } else {
    // For product, find SupplierProduct with productId (no variant)
    const supplierProduct = await SupplierProduct.findOne({
      productId: scopeObjId,
      variantId: null,
      status: 'active',
    }).lean();

    if (supplierProduct) {
      stockLevel = supplierProduct.stockQuantity || 0;
      costPrice = supplierProduct.costPrice || 0;
    }

    // Get current selling price from ResellerProduct
    const resellerProduct = await ResellerProduct.findOne({
      productId: scopeObjId,
      variantId: null,
      status: 'active',
      ...(resellerId ? { resellerId: new mongoose.Types.ObjectId(resellerId) } : {}),
    }).lean();

    if (resellerProduct) {
      currentSellingPrice = resellerProduct.sellingPrice || 0;
    }
  }

  // Calculate stock velocity (days of stock remaining)
  const stockVelocity = avgDailyOrders > 0 ? stockLevel / avgDailyOrders : stockLevel > 0 ? 999 : 0;

  // Calculate average margin
  let avgMargin = 0;
  if (costPrice > 0 && currentSellingPrice > 0) {
    avgMargin = ((currentSellingPrice - costPrice) / currentSellingPrice) * 100;
  } else if (costPrice > 0 && prices.length > 0) {
    // Use average selling price from orders if current price not available
    const avgSellingPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    avgMargin = ((avgSellingPrice - costPrice) / avgSellingPrice) * 100;
  }

  // Calculate average selling price
  const avgSellingPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : currentSellingPrice;

  // Calculate price elasticity score (simplified heuristic)
  // Higher score = more price sensitive (elastic)
  // Lower score = less price sensitive (inelastic)
  let priceElasticityScore = 50; // Default: moderate elasticity

  if (totalOrders > 0 && prices.length > 0) {
    // If we have price variation and order data, calculate elasticity
    const priceStdDev = calculateStandardDeviation(prices);
    const avgPrice = avgSellingPrice;

    if (avgPrice > 0) {
      const priceVariation = (priceStdDev / avgPrice) * 100;

      // If prices vary a lot and orders are consistent, product is inelastic
      // If prices vary little but orders vary, product is elastic
      // Simplified: use price variation as proxy
      if (priceVariation > 20) {
        priceElasticityScore = 30; // Less elastic (price changes don't affect demand much)
      } else if (priceVariation < 5) {
        priceElasticityScore = 70; // More elastic (price changes affect demand)
      }
    }

    // Adjust based on sales volume
    if (avgDailyOrders > 10) {
      priceElasticityScore += 10; // High volume = more elastic
    } else if (avgDailyOrders < 1) {
      priceElasticityScore -= 10; // Low volume = less elastic
    }

    // Clamp to 0-100
    priceElasticityScore = Math.max(0, Math.min(100, priceElasticityScore));
  }

  return {
    avgDailyOrders,
    stockLevel,
    stockVelocity,
    avgMargin,
    priceElasticityScore,
    totalOrders,
    totalQuantitySold,
    avgSellingPrice,
    costPrice,
    currentSellingPrice,
  };
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Get price trend (simplified)
 * Compare recent prices vs older prices
 */
export async function getPriceTrend(
  scope: 'product' | 'variant',
  scopeId: mongoose.Types.ObjectId | string,
  days: number = 30
): Promise<'increasing' | 'decreasing' | 'stable'> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const orders = await Order.find({
    status: 'paid',
    createdAt: { $gte: cutoffDate },
  })
    .sort({ createdAt: 1 })
    .lean();

  const prices: Array<{ price: number; date: Date }> = [];

  for (const order of orders) {
    for (const item of order.items) {
      if (item.productId === scopeId.toString()) {
        prices.push({ price: item.unitPrice, date: order.createdAt });
      }
    }
  }

  if (prices.length < 2) {
    return 'stable';
  }

  // Split into two halves
  const midPoint = Math.floor(prices.length / 2);
  const firstHalf = prices.slice(0, midPoint);
  const secondHalf = prices.slice(midPoint);

  const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p.price, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p.price, 0) / secondHalf.length;

  const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

  if (changePercent > 5) {
    return 'increasing';
  } else if (changePercent < -5) {
    return 'decreasing';
  } else {
    return 'stable';
  }
}

