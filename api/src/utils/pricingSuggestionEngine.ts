import { PricingMetrics } from './pricingDataAggregator';
import { resolvePricingRules } from './pricingEngine';
import { resolveMarkupRule } from './markupEngine';
import mongoose from 'mongoose';

/**
 * Pricing Suggestion Engine
 * 
 * PURPOSE:
 * - Generate AI-based pricing suggestions (advisory only)
 * - Use heuristics based on sales, demand, stock, margin data
 * - Never auto-apply prices
 * - Fully respect Admin Pricing Rules
 * 
 * HEURISTICS:
 * - High demand + low stock → suggest price increase
 * - Low demand + high stock → suggest price decrease
 * - Margin too low → suggest price increase
 * - Margin very high + low sales → suggest price decrease
 * 
 * SAFETY:
 * - Always clamp suggestions within admin pricing limits
 * - Provide explainable reasons
 * - Include confidence scores
 */

export interface PricingSuggestionParams {
  currentPrice: number;
  costPrice: number;
  stockLevel: number;
  avgDailyOrders: number;
  stockVelocity: number; // Days of stock remaining
  avgMargin: number;
  priceElasticityScore: number;
  productId: mongoose.Types.ObjectId | string;
  variantId?: mongoose.Types.ObjectId | string | null;
  categoryId?: mongoose.Types.ObjectId | string | null;
}

export interface PricingSuggestionResult {
  suggestedPrice: number;
  reason: string;
  confidenceScore: number; // 0-100
  expectedImpact: {
    salesChange: 'increase' | 'decrease' | 'neutral';
    marginChange: 'increase' | 'decrease' | 'neutral';
    estimatedSalesChangePercent?: number;
    estimatedMarginChangePercent?: number;
  };
  adminConstraints: {
    minPrice: number | null;
    maxPrice: number | null;
    withinLimits: boolean;
  };
  factors: string[]; // What factors influenced this suggestion
}

/**
 * Generate pricing suggestion based on metrics
 */
export async function generatePricingSuggestion(
  params: PricingSuggestionParams
): Promise<PricingSuggestionResult> {
  const {
    currentPrice,
    costPrice,
    stockLevel,
    avgDailyOrders,
    stockVelocity,
    avgMargin,
    priceElasticityScore,
    productId,
    variantId,
    categoryId,
  } = params;

  // Get admin pricing rules to determine min/max limits
  const pricingRules = await resolvePricingRules({
    productId,
    variantId: variantId || null,
    categoryId: categoryId || null,
    supplierCost: costPrice,
    proposedSellingPrice: currentPrice,
    enforceOn: 'storefront',
  });

  const adminMinPrice = pricingRules.finalAllowedPriceRange.min;
  const adminMaxPrice = pricingRules.finalAllowedPriceRange.max;

  // Get markup rules to determine markup boundaries
  const markupResult = await resolveMarkupRule({
    variantId: variantId || null,
    productId,
    categoryId: categoryId || null,
    supplierCost: costPrice,
    appliesTo: 'store',
  });

  const markupMinPrice = markupResult.minSellingPrice;
  const markupMaxPrice = markupResult.maxSellingPrice;

  // Initialize suggestion with current price
  let suggestedPrice = currentPrice;
  const factors: string[] = [];
  let confidenceScore = 50; // Start with moderate confidence

  // HEURISTIC 1: High demand + low stock → suggest increase
  const highDemand = avgDailyOrders > 5; // More than 5 orders per day
  const lowStock = stockVelocity < 7; // Less than 7 days of stock remaining
  const veryLowStock = stockVelocity < 3; // Less than 3 days of stock remaining

  if (highDemand && veryLowStock) {
    // Strong signal: high demand + very low stock
    const increasePercent = Math.min(15, 5 + (5 - stockVelocity) * 2); // 5-15% increase
    suggestedPrice = currentPrice * (1 + increasePercent / 100);
    factors.push(`High demand (${avgDailyOrders.toFixed(1)} orders/day) with very low stock (${stockVelocity.toFixed(1)} days remaining)`);
    confidenceScore += 25;
  } else if (highDemand && lowStock) {
    // Moderate signal: high demand + low stock
    const increasePercent = Math.min(10, 3 + (7 - stockVelocity) * 1); // 3-10% increase
    suggestedPrice = currentPrice * (1 + increasePercent / 100);
    factors.push(`High demand (${avgDailyOrders.toFixed(1)} orders/day) with low stock (${stockVelocity.toFixed(1)} days remaining)`);
    confidenceScore += 15;
  }

  // HEURISTIC 2: Low demand + high stock → suggest decrease
  const lowDemand = avgDailyOrders < 1; // Less than 1 order per day
  const highStock = stockVelocity > 30; // More than 30 days of stock remaining
  const veryHighStock = stockVelocity > 60; // More than 60 days of stock remaining

  if (lowDemand && veryHighStock) {
    // Strong signal: low demand + very high stock
    const decreasePercent = Math.min(20, 10 + (stockVelocity - 60) / 10); // 10-20% decrease
    suggestedPrice = currentPrice * (1 - decreasePercent / 100);
    factors.push(`Low demand (${avgDailyOrders.toFixed(1)} orders/day) with very high stock (${stockVelocity.toFixed(1)} days remaining)`);
    confidenceScore += 25;
  } else if (lowDemand && highStock) {
    // Moderate signal: low demand + high stock
    const decreasePercent = Math.min(15, 5 + (stockVelocity - 30) / 10); // 5-15% decrease
    suggestedPrice = currentPrice * (1 - decreasePercent / 100);
    factors.push(`Low demand (${avgDailyOrders.toFixed(1)} orders/day) with high stock (${stockVelocity.toFixed(1)} days remaining)`);
    confidenceScore += 15;
  }

  // HEURISTIC 3: Margin too low → suggest increase
  const veryLowMargin = avgMargin < 10; // Less than 10% margin
  const lowMargin = avgMargin < 20; // Less than 20% margin

  if (veryLowMargin && currentPrice > costPrice) {
    // Strong signal: very low margin
    const targetMargin = 15; // Target 15% margin
    const targetPrice = costPrice / (1 - targetMargin / 100);
    if (targetPrice > suggestedPrice) {
      const increasePercent = ((targetPrice - suggestedPrice) / suggestedPrice) * 100;
      suggestedPrice = Math.min(suggestedPrice * 1.1, targetPrice); // Cap at 10% increase or target
      factors.push(`Very low margin (${avgMargin.toFixed(1)}%) - targeting minimum 15% margin`);
      confidenceScore += 20;
    }
  } else if (lowMargin && currentPrice > costPrice) {
    // Moderate signal: low margin
    const targetMargin = 20; // Target 20% margin
    const targetPrice = costPrice / (1 - targetMargin / 100);
    if (targetPrice > suggestedPrice) {
      const increasePercent = ((targetPrice - suggestedPrice) / suggestedPrice) * 100;
      suggestedPrice = Math.min(suggestedPrice * 1.05, targetPrice); // Cap at 5% increase or target
      factors.push(`Low margin (${avgMargin.toFixed(1)}%) - targeting 20% margin`);
      confidenceScore += 10;
    }
  }

  // HEURISTIC 4: Margin very high + low sales → suggest decrease
  const veryHighMargin = avgMargin > 50; // More than 50% margin
  const moderateHighMargin = avgMargin > 40; // More than 40% margin

  if (veryHighMargin && lowDemand) {
    // Strong signal: very high margin + low sales
    const decreasePercent = Math.min(15, (avgMargin - 50) / 2); // Up to 15% decrease
    suggestedPrice = currentPrice * (1 - decreasePercent / 100);
    factors.push(`Very high margin (${avgMargin.toFixed(1)}%) with low sales - optimizing for volume`);
    confidenceScore += 20;
  } else if (moderateHighMargin && lowDemand) {
    // Moderate signal: high margin + low sales
    const decreasePercent = Math.min(10, (avgMargin - 40) / 2); // Up to 10% decrease
    suggestedPrice = currentPrice * (1 - decreasePercent / 100);
    factors.push(`High margin (${avgMargin.toFixed(1)}%) with low sales - optimizing for volume`);
    confidenceScore += 10;
  }

  // Adjust based on price elasticity
  // If product is price elastic, be more conservative with increases
  if (priceElasticityScore > 70 && suggestedPrice > currentPrice) {
    // High elasticity: price increases will significantly reduce demand
    const reduction = (suggestedPrice - currentPrice) * 0.3; // Reduce increase by 30%
    suggestedPrice = currentPrice + (suggestedPrice - currentPrice - reduction);
    factors.push(`Price-elastic product - conservative increase to maintain demand`);
    confidenceScore -= 5;
  } else if (priceElasticityScore < 30 && suggestedPrice < currentPrice) {
    // Low elasticity: price decreases won't significantly increase demand
    const reduction = (currentPrice - suggestedPrice) * 0.3; // Reduce decrease by 30%
    suggestedPrice = currentPrice - (currentPrice - suggestedPrice - reduction);
    factors.push(`Price-inelastic product - conservative decrease`);
    confidenceScore -= 5;
  }

  // Clamp to admin pricing limits
  let withinLimits = true;
  if (adminMinPrice !== null && suggestedPrice < adminMinPrice) {
    suggestedPrice = adminMinPrice;
    withinLimits = false;
    factors.push(`Clamped to admin minimum price (₹${adminMinPrice.toFixed(2)})`);
    confidenceScore -= 10;
  }
  if (adminMaxPrice !== null && suggestedPrice > adminMaxPrice) {
    suggestedPrice = adminMaxPrice;
    withinLimits = false;
    factors.push(`Clamped to admin maximum price (₹${adminMaxPrice.toFixed(2)})`);
    confidenceScore -= 10;
  }

  // Clamp to markup rule boundaries (STEP 6: Enforce markup in AI suggestions)
  if (suggestedPrice < markupMinPrice) {
    suggestedPrice = markupMinPrice;
    withinLimits = false;
    factors.push(`Clamped to markup rule minimum price (₹${markupMinPrice.toFixed(2)})`);
    confidenceScore -= 10;
  }
  if (markupMaxPrice !== null && suggestedPrice > markupMaxPrice) {
    suggestedPrice = markupMaxPrice;
    withinLimits = false;
    factors.push(`Clamped to markup rule maximum price (₹${markupMaxPrice.toFixed(2)})`);
    confidenceScore -= 10;
  }

  // Round to 2 decimal places
  suggestedPrice = Math.round(suggestedPrice * 100) / 100;

  // Calculate expected impact
  const priceChangePercent = ((suggestedPrice - currentPrice) / currentPrice) * 100;
  const newMargin = costPrice > 0 ? ((suggestedPrice - costPrice) / suggestedPrice) * 100 : avgMargin;

  let salesChange: 'increase' | 'decrease' | 'neutral' = 'neutral';
  let marginChange: 'increase' | 'decrease' | 'neutral' = 'neutral';
  let estimatedSalesChangePercent: number | undefined;
  let estimatedMarginChangePercent: number | undefined;

  if (Math.abs(priceChangePercent) < 1) {
    // Less than 1% change = neutral
    salesChange = 'neutral';
    marginChange = 'neutral';
  } else if (suggestedPrice > currentPrice) {
    // Price increase
    salesChange = 'decrease'; // Typically reduces sales volume
    marginChange = 'increase'; // Increases margin per unit
    // Estimate sales change based on elasticity
    estimatedSalesChangePercent = -(priceChangePercent * (priceElasticityScore / 100));
    estimatedMarginChangePercent = ((newMargin - avgMargin) / avgMargin) * 100;
  } else {
    // Price decrease
    salesChange = 'increase'; // Typically increases sales volume
    marginChange = 'decrease'; // Decreases margin per unit
    // Estimate sales change based on elasticity
    estimatedSalesChangePercent = Math.abs(priceChangePercent * (priceElasticityScore / 100));
    estimatedMarginChangePercent = ((newMargin - avgMargin) / avgMargin) * 100;
  }

  // Generate human-readable reason
  let reason = '';
  if (factors.length === 0) {
    reason = 'No significant pricing adjustments recommended based on current metrics.';
  } else {
    reason = `Suggested ${priceChangePercent > 0 ? 'increase' : priceChangePercent < 0 ? 'decrease' : 'maintain'} of ${Math.abs(priceChangePercent).toFixed(1)}% based on: ${factors.join('; ')}.`;
  }

  // Clamp confidence score to 0-100
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  return {
    suggestedPrice,
    reason,
    confidenceScore,
    expectedImpact: {
      salesChange,
      marginChange,
      estimatedSalesChangePercent,
      estimatedMarginChangePercent,
    },
    adminConstraints: {
      minPrice: adminMinPrice,
      maxPrice: adminMaxPrice,
      withinLimits,
    },
    factors,
  };
}

