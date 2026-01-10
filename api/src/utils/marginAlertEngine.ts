import mongoose from 'mongoose';
import { resolveMarkupRule, MarkupResolutionResult } from './markupEngine';
import { aggregatePricingMetrics } from './pricingDataAggregator';
import { MarginAlert } from '../models/MarginAlert';

/**
 * Margin Alert Engine Utility
 * 
 * PURPOSE:
 * - Evaluate margins against markup rules and historical data
 * - Generate alerts for margin risks
 * - Never auto-change prices
 * - Act as early-warning system
 * 
 * ALERT TYPES:
 * - below_min_markup: Margin is below minimum required
 * - near_min_markup: Margin is within X% of minimum (warning)
 * - abnormally_high_markup: Margin is unusually high (possible pricing error)
 * - sudden_margin_drop: Margin dropped significantly vs historical average
 */

export interface MarginEvaluationParams {
  sellingPrice: number;
  supplierCost: number;
  variantId?: mongoose.Types.ObjectId | string | null;
  productId?: mongoose.Types.ObjectId | string | null;
  categoryId?: mongoose.Types.ObjectId | string | null;
  brandId?: mongoose.Types.ObjectId | string | null;
  resellerId?: mongoose.Types.ObjectId | string | null;
  appliesTo: 'reseller' | 'store';
  regionId?: mongoose.Types.ObjectId | string | null;
}

export interface MarginEvaluationResult {
  shouldAlert: boolean;
  alertType?: 'below_min_markup' | 'near_min_markup' | 'abnormally_high_markup' | 'sudden_margin_drop';
  severity?: 'low' | 'medium' | 'high';
  message?: string;
  currentMargin: number;
  currentMarginPercent: number;
  expectedMinMargin: number;
  expectedMinMarginPercent: number;
  deviationPercentage: number;
  historicalAverage?: number;
}

// Configuration constants
const NEAR_MIN_THRESHOLD = 5; // Alert if within 5% of minimum
const ABNORMALLY_HIGH_THRESHOLD = 200; // Alert if margin is 200%+ above minimum (possible error)
const SUDDEN_DROP_THRESHOLD = 30; // Alert if margin drops 30%+ vs historical average

/**
 * Evaluate margin and determine if alert should be generated
 */
export async function evaluateMargin(
  params: MarginEvaluationParams
): Promise<MarginEvaluationResult> {
  const { sellingPrice, supplierCost, variantId, productId, categoryId, brandId, resellerId, appliesTo, regionId } = params;

  // Calculate current margin
  const currentMargin = sellingPrice - supplierCost;
  const currentMarginPercent = supplierCost > 0 ? (currentMargin / supplierCost) * 100 : 0;

  // Get markup rule to determine expected minimum margin
  const markupResult = await resolveMarkupRule({
    variantId: variantId || null,
    productId: productId || null,
    categoryId: categoryId || null,
    brandId: brandId || null,
    regionId: regionId || null,
    supplierCost,
    appliesTo,
  });

  const expectedMinMargin = markupResult.minSellingPrice - supplierCost;
  const expectedMinMarginPercent = supplierCost > 0 ? (expectedMinMargin / supplierCost) * 100 : 0;

  // Calculate deviation
  const deviationPercentage = expectedMinMargin > 0
    ? ((currentMargin - expectedMinMargin) / expectedMinMargin) * 100
    : 0;

  // Get historical margin data if available
  let historicalAverage: number | undefined;
  if (productId || variantId) {
    try {
      const metrics = await aggregatePricingMetrics({
        scope: variantId ? 'variant' : 'product',
        scopeId: (variantId || productId)!.toString(),
        resellerId: resellerId?.toString(),
        days: 30,
      });
      if (metrics && metrics.avgMargin) {
        historicalAverage = metrics.avgMargin;
      }
    } catch (error) {
      // Silently fail - historical data is optional
      console.error('[MARGIN ALERT] Failed to get historical data:', error);
    }
  }

  // Evaluate alert conditions
  let shouldAlert = false;
  let alertType: 'below_min_markup' | 'near_min_markup' | 'abnormally_high_markup' | 'sudden_margin_drop' | undefined;
  let severity: 'low' | 'medium' | 'high' | undefined;
  let message: string | undefined;

  // 1. BELOW MIN MARKUP (HIGH severity)
  if (currentMargin < expectedMinMargin) {
    shouldAlert = true;
    alertType = 'below_min_markup';
    severity = 'high';
    const shortfall = expectedMinMargin - currentMargin;
    const shortfallPercent = expectedMinMargin > 0 ? ((shortfall / expectedMinMargin) * 100).toFixed(1) : '0';
    message = `Margin is ₹${shortfall.toFixed(2)} (${shortfallPercent}%) below minimum required. Current: ${currentMarginPercent.toFixed(1)}%, Required: ${expectedMinMarginPercent.toFixed(1)}%`;
  }
  // 2. NEAR MIN MARKUP (MEDIUM severity)
  else if (currentMargin >= expectedMinMargin && deviationPercentage <= NEAR_MIN_THRESHOLD) {
    shouldAlert = true;
    alertType = 'near_min_markup';
    severity = 'medium';
    message = `Margin is within ${NEAR_MIN_THRESHOLD}% of minimum. Current: ${currentMarginPercent.toFixed(1)}%, Required: ${expectedMinMarginPercent.toFixed(1)}%. Consider increasing price to maintain safe margin.`;
  }
  // 3. SUDDEN MARGIN DROP (HIGH severity if significant, MEDIUM if moderate)
  else if (historicalAverage !== undefined && currentMarginPercent < historicalAverage) {
    const dropPercent = ((historicalAverage - currentMarginPercent) / historicalAverage) * 100;
    if (dropPercent >= SUDDEN_DROP_THRESHOLD) {
      shouldAlert = true;
      alertType = 'sudden_margin_drop';
      severity = dropPercent >= 50 ? 'high' : 'medium';
      message = `Margin dropped ${dropPercent.toFixed(1)}% vs 30-day average. Current: ${currentMarginPercent.toFixed(1)}%, Average: ${historicalAverage.toFixed(1)}%. This may indicate pricing issues.`;
    }
  }
  // 4. ABNORMALLY HIGH MARKUP (LOW severity - possible pricing error)
  else if (deviationPercentage >= ABNORMALLY_HIGH_THRESHOLD) {
    shouldAlert = true;
    alertType = 'abnormally_high_markup';
    severity = 'low';
    message = `Margin is ${deviationPercentage.toFixed(1)}% above minimum (${currentMarginPercent.toFixed(1)}% vs ${expectedMinMarginPercent.toFixed(1)}%). This may be a pricing error or intentional premium pricing.`;
  }

  return {
    shouldAlert,
    alertType,
    severity,
    message,
    currentMargin,
    currentMarginPercent,
    expectedMinMargin,
    expectedMinMarginPercent,
    deviationPercentage,
    historicalAverage,
  };
}

/**
 * Create margin alert (with cooldown check to prevent duplicates)
 */
export async function createMarginAlert(
  evaluation: MarginEvaluationResult,
  params: MarginEvaluationParams & {
    scope: 'variant' | 'product' | 'brand' | 'reseller';
    scopeId?: mongoose.Types.ObjectId | string | null;
  }
): Promise<{ created: boolean; alertId?: string; reason?: string }> {
  if (!evaluation.shouldAlert || !evaluation.alertType || !evaluation.severity || !evaluation.message) {
    return { created: false, reason: 'No alert needed' };
  }

  const { scope, scopeId, resellerId } = params;

  // Cooldown: Check if same alert type exists within last 24 hours
  const cooldownWindow = new Date();
  cooldownWindow.setHours(cooldownWindow.getHours() - 24);

  const existingAlert = await MarginAlert.findOne({
    alertType: evaluation.alertType,
    scope,
    scopeId: scopeId || null,
    resellerId: resellerId ? new mongoose.Types.ObjectId(resellerId) : null,
    status: { $in: ['open', 'acknowledged'] },
    createdAt: { $gte: cooldownWindow },
  });

  if (existingAlert) {
    return { created: false, reason: 'Similar alert already exists within cooldown window' };
  }

  // Create alert
  const alert = new MarginAlert({
    alertType: evaluation.alertType,
    scope,
    scopeId: scopeId || null,
    resellerId: resellerId ? new mongoose.Types.ObjectId(resellerId) : null,
    currentMargin: evaluation.currentMargin,
    currentMarginPercent: evaluation.currentMarginPercent,
    expectedMinMargin: evaluation.expectedMinMargin,
    expectedMinMarginPercent: evaluation.expectedMinMarginPercent,
    deviationPercentage: evaluation.deviationPercentage,
    severity: evaluation.severity,
    message: evaluation.message,
    status: 'open',
    metadata: {
      sellingPrice: params.sellingPrice,
      supplierCost: params.supplierCost,
      historicalAverage: evaluation.historicalAverage,
    },
  });

  await alert.save();

  return { created: true, alertId: alert._id.toString() };
}

/**
 * Evaluate and create margin alert in one call
 */
export async function evaluateAndCreateMarginAlert(
  params: MarginEvaluationParams & {
    scope: 'variant' | 'product' | 'brand' | 'reseller';
    scopeId?: mongoose.Types.ObjectId | string | null;
  }
): Promise<{ created: boolean; alertId?: string; evaluation: MarginEvaluationResult }> {
  const evaluation = await evaluateMargin(params);
  const result = await createMarginAlert(evaluation, params);

  return {
    ...result,
    evaluation,
  };
}

