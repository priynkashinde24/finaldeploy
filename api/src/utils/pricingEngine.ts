import mongoose from 'mongoose';
import { PricingRule } from '../models/PricingRule';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { Category } from '../models/Category';

/**
 * Pricing Engine Utility
 * 
 * PURPOSE:
 * - Resolve pricing rules based on scope hierarchy
 * - Validate pricing against rules
 * - Return allowed price ranges and applied rules
 * 
 * SCOPE PRIORITY (highest to lowest):
 * 1. Variant (most specific)
 * 2. Product
 * 3. Category
 * 4. Global (fallback)
 * 
 * VALIDATIONS:
 * - sellingPrice >= supplierCost + minMargin
 * - sellingPrice within min/max limits
 * - Reject pricing if violation
 */

export interface PricingResolutionParams {
  productId: mongoose.Types.ObjectId | string;
  variantId?: mongoose.Types.ObjectId | string | null;
  categoryId?: mongoose.Types.ObjectId | string | null;
  supplierCost: number; // Supplier's cost price
  resellerMargin?: number; // Reseller's margin percentage (optional)
  proposedSellingPrice?: number; // Proposed selling price to validate
  enforceOn: 'reseller' | 'storefront'; // Where this validation is happening
}

export interface PricingResolutionResult {
  allowed: boolean;
  finalAllowedPriceRange: {
    min: number;
    max: number | null; // null means no maximum
  };
  appliedRuleId?: string;
  appliedRule?: any;
  violations: string[];
  calculatedMinPrice: number; // Based on supplier cost + margin
}

/**
 * Resolve pricing rules based on scope hierarchy
 */
export async function resolvePricingRules(
  params: PricingResolutionParams
): Promise<PricingResolutionResult> {
  const {
    productId,
    variantId,
    categoryId,
    supplierCost,
    resellerMargin,
    proposedSellingPrice,
    enforceOn,
  } = params;

  const violations: string[] = [];
  let appliedRule: any = null;
  let appliedRuleId: string | undefined = undefined;

  // Convert IDs to ObjectId if needed
  const productObjId = new mongoose.Types.ObjectId(productId);
  const variantObjId = variantId ? new mongoose.Types.ObjectId(variantId) : null;
  const categoryObjId = categoryId ? new mongoose.Types.ObjectId(categoryId) : null;

  // Fetch product and category if needed
  let productCategoryId: mongoose.Types.ObjectId | null = null;
  if (!categoryObjId) {
    const product = await Product.findById(productObjId).lean();
    if (product) {
      productCategoryId = product.categoryId as mongoose.Types.ObjectId;
    }
  } else {
    productCategoryId = categoryObjId;
  }

  // Resolve rules in priority order: Variant → Product → Category → Global
  const rules: any[] = [];

  // 1. Variant rule (highest priority)
  if (variantObjId) {
    const variantRule = await PricingRule.findOne({
      scope: 'variant',
      scopeId: variantObjId,
      status: 'active',
      enforceOn: enforceOn,
    }).lean();
    if (variantRule) {
      rules.push(variantRule);
    }
  }

  // 2. Product rule
  const productRule = await PricingRule.findOne({
    scope: 'product',
    scopeId: productObjId,
    status: 'active',
    enforceOn: enforceOn,
  }).lean();
  if (productRule) {
    rules.push(productRule);
  }

  // 3. Category rule
  if (productCategoryId) {
    const categoryRule = await PricingRule.findOne({
      scope: 'category',
      scopeId: productCategoryId,
      status: 'active',
      enforceOn: enforceOn,
    }).lean();
    if (categoryRule) {
      rules.push(categoryRule);
    }
  }

  // 4. Global rule (fallback)
  const globalRule = await PricingRule.findOne({
    scope: 'global',
    scopeId: null,
    status: 'active',
    enforceOn: enforceOn,
  }).lean();
  if (globalRule) {
    rules.push(globalRule);
  }

  // Use the first rule found (highest priority)
  if (rules.length > 0) {
    appliedRule = rules[0];
    appliedRuleId = appliedRule._id.toString();
  }

  // Calculate minimum price based on supplier cost + margin
  let calculatedMinPrice = supplierCost;

  if (appliedRule) {
    // Calculate minimum margin requirement
    let minMarginAmount = 0;

    if (appliedRule.minMarginType === 'amount') {
      minMarginAmount = appliedRule.minMarginValue;
    } else if (appliedRule.minMarginType === 'percentage') {
      minMarginAmount = (supplierCost * appliedRule.minMarginValue) / 100;
    }

    calculatedMinPrice = supplierCost + minMarginAmount;

    // Apply minimum selling price floor if set
    if (appliedRule.minSellingPrice !== null && appliedRule.minSellingPrice !== undefined) {
      calculatedMinPrice = Math.max(calculatedMinPrice, appliedRule.minSellingPrice);
    }
  } else if (resellerMargin !== undefined && resellerMargin !== null) {
    // If no rule but margin is provided, calculate from margin
    calculatedMinPrice = supplierCost * (1 + resellerMargin / 100);
  }

  // Determine final allowed price range
  const finalAllowedPriceRange = {
    min: calculatedMinPrice,
    max: appliedRule?.maxSellingPrice || null,
  };

  // Validate proposed selling price if provided
  if (proposedSellingPrice !== undefined && proposedSellingPrice !== null) {
    if (proposedSellingPrice < finalAllowedPriceRange.min) {
      const minMargin = finalAllowedPriceRange.min - supplierCost;
      if (appliedRule?.minMarginType === 'amount') {
        violations.push(
          `Minimum margin ₹${appliedRule.minMarginValue.toFixed(2)} required by admin pricing rule. Minimum selling price: ₹${finalAllowedPriceRange.min.toFixed(2)}`
        );
      } else if (appliedRule?.minMarginType === 'percentage') {
        violations.push(
          `Minimum margin ${appliedRule.minMarginValue}% required by admin pricing rule. Minimum selling price: ₹${finalAllowedPriceRange.min.toFixed(2)}`
        );
      } else {
        violations.push(
          `Selling price ₹${proposedSellingPrice.toFixed(2)} is below minimum required price of ₹${finalAllowedPriceRange.min.toFixed(2)}`
        );
      }
    }

    if (finalAllowedPriceRange.max !== null && proposedSellingPrice > finalAllowedPriceRange.max) {
      violations.push(
        `Selling price ₹${proposedSellingPrice.toFixed(2)} exceeds maximum allowed price of ₹${finalAllowedPriceRange.max.toFixed(2)}`
      );
    }

    // Check discount percentage if rule has maxDiscountPercentage
    if (appliedRule?.maxDiscountPercentage !== null && appliedRule?.maxDiscountPercentage !== undefined) {
      // This would require knowing the base/reference price
      // For now, we'll skip this validation as it requires additional context
    }
  }

  return {
    allowed: violations.length === 0,
    finalAllowedPriceRange,
    appliedRuleId,
    appliedRule,
    violations,
    calculatedMinPrice,
  };
}

