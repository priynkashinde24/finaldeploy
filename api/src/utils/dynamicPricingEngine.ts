import mongoose from 'mongoose';
import { DynamicPricingRule } from '../models/DynamicPricingRule';
import { Product } from '../models/Product';
import { Order } from '../models/Order';

/**
 * Dynamic Pricing Engine Utility
 * 
 * PURPOSE:
 * - Resolve dynamic pricing rules based on conditions
 * - Adjust price based on stock, demand, or time
 * - Return adjusted price and rule information
 * 
 * LOGIC:
 * 1. Match applicable dynamic rules by scope
 * 2. Evaluate trigger conditions
 * 3. Pick highest priority rule
 * 4. Calculate price adjustment
 * 5. Return adjusted price and breakdown
 */

export interface DynamicPriceResolutionParams {
  baseSellingPrice: number; // Base reseller selling price
  variantId?: mongoose.Types.ObjectId | string | null;
  productId: mongoose.Types.ObjectId | string;
  categoryId?: mongoose.Types.ObjectId | string | null;
  currentStock: number; // Current stock quantity
  recentOrderCount?: number; // Orders in recent period (e.g., last 24 hours)
}

export interface AdjustmentBreakdown {
  basePrice: number;
  adjustmentAmount: number;
  adjustmentPercentage: number;
  adjustedPrice: number;
  appliedRuleId?: string;
  appliedRule?: any;
  triggerType?: string;
}

export interface DynamicPriceResolutionResult {
  adjusted: boolean; // Whether any rule was applied
  adjustedPrice: number; // Final adjusted price
  adjustmentBreakdown?: AdjustmentBreakdown;
}

/**
 * Resolve dynamic pricing for a product
 */
export async function resolveDynamicPrice(
  params: DynamicPriceResolutionParams
): Promise<DynamicPriceResolutionResult> {
  const { baseSellingPrice, variantId, productId, categoryId, currentStock, recentOrderCount = 0 } = params;

  // Convert IDs to ObjectId if needed
  const productObjId = new mongoose.Types.ObjectId(productId);
  const variantObjId = variantId ? new mongoose.Types.ObjectId(variantId) : null;
  const categoryObjId = categoryId ? new mongoose.Types.ObjectId(categoryId) : null;

  // Get product to find category if not provided
  let productCategoryId: mongoose.Types.ObjectId | null = null;
  if (!categoryObjId) {
    const product = await Product.findById(productObjId).lean();
    if (product) {
      productCategoryId = product.categoryId as mongoose.Types.ObjectId;
    }
  } else {
    productCategoryId = categoryObjId;
  }

  // Find applicable dynamic pricing rules (priority: variant → product → category → global)
  const applicableRules: any[] = [];

  // Variant rules
  if (variantObjId) {
    const variantRules = await DynamicPricingRule.find({
      scope: 'variant',
      scopeId: variantObjId,
      status: 'active',
    })
      .sort({ priority: -1 })
      .lean();
    applicableRules.push(...variantRules);
  }

  // Product rules
  const productRules = await DynamicPricingRule.find({
    scope: 'product',
    scopeId: productObjId,
    status: 'active',
  })
    .sort({ priority: -1 })
    .lean();
  applicableRules.push(...productRules);

  // Category rules
  if (productCategoryId) {
    const categoryRules = await DynamicPricingRule.find({
      scope: 'category',
      scopeId: productCategoryId,
      status: 'active',
    })
      .sort({ priority: -1 })
      .lean();
    applicableRules.push(...categoryRules);
  }

  // Global rules
  const globalRules = await DynamicPricingRule.find({
    scope: 'global',
    scopeId: null,
    status: 'active',
  })
    .sort({ priority: -1 })
    .lean();
  applicableRules.push(...globalRules);

  // Evaluate rules and find the first matching one (highest priority)
  const now = new Date();
  let matchedRule: any = null;

  for (const rule of applicableRules) {
    let matches = false;

    // Evaluate trigger conditions
    if (rule.triggerType === 'low_stock') {
      if (rule.conditions.stockBelow !== null && currentStock < rule.conditions.stockBelow) {
        matches = true;
      }
    } else if (rule.triggerType === 'high_demand') {
      if (rule.conditions.ordersAbove !== null && recentOrderCount > rule.conditions.ordersAbove) {
        matches = true;
      }
    } else if (rule.triggerType === 'time_window') {
      if (
        rule.conditions.startTime &&
        rule.conditions.endTime &&
        now >= new Date(rule.conditions.startTime) &&
        now <= new Date(rule.conditions.endTime)
      ) {
        matches = true;
      }
    }

    if (matches) {
      matchedRule = rule;
      break; // Use first matching rule (highest priority)
    }
  }

  // If no rule matches, return base price
  if (!matchedRule) {
    return {
      adjusted: false,
      adjustedPrice: baseSellingPrice,
    };
  }

  // Calculate price adjustment
  let adjustmentAmount = 0;

  if (matchedRule.adjustmentMode === 'percentage') {
    adjustmentAmount = (baseSellingPrice * matchedRule.adjustmentValue) / 100;
  } else {
    adjustmentAmount = matchedRule.adjustmentValue;
  }

  // Apply max adjustment limit if set
  if (matchedRule.maxAdjustmentLimit !== null && adjustmentAmount > matchedRule.maxAdjustmentLimit) {
    adjustmentAmount = matchedRule.maxAdjustmentLimit;
  }

  // Apply adjustment direction
  let adjustedPrice = baseSellingPrice;
  if (matchedRule.adjustmentType === 'increase') {
    adjustedPrice = baseSellingPrice + adjustmentAmount;
  } else {
    adjustedPrice = Math.max(0, baseSellingPrice - adjustmentAmount); // Don't go below 0
  }

  const adjustmentPercentage = (adjustmentAmount / baseSellingPrice) * 100;

  const breakdown: AdjustmentBreakdown = {
    basePrice: baseSellingPrice,
    adjustmentAmount,
    adjustmentPercentage,
    adjustedPrice,
    appliedRuleId: matchedRule._id.toString(),
    appliedRule: matchedRule,
    triggerType: matchedRule.triggerType,
  };

  return {
    adjusted: true,
    adjustedPrice,
    adjustmentBreakdown: breakdown,
  };
}

/**
 * Get recent order count for a product (helper function)
 */
export async function getRecentOrderCount(
  productId: mongoose.Types.ObjectId | string,
  hours: number = 24
): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const productObjId = new mongoose.Types.ObjectId(productId);

  const count = await Order.countDocuments({
    'items.productId': productObjId.toString(),
    createdAt: { $gte: since },
    status: { $ne: 'cancelled' },
  });

  return count;
}

