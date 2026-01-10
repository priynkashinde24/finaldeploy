import mongoose from 'mongoose';
import { MarkupRule } from '../models/MarkupRule';
import { Product } from '../models/Product';

/**
 * Markup Engine Utility
 * 
 * PURPOSE:
 * - Resolve markup rules based on scope hierarchy and priority
 * - Calculate min/max selling price boundaries from supplier cost
 * - Return price boundaries for validation
 * 
 * SCOPE PRIORITY (highest to lowest):
 * 
 * Region-specific (if regionId provided):
 * 1. Variant + Region
 * 2. Product + Region
 * 3. Brand + Region
 * 4. Category + Region
 * 5. Global + Region
 * 
 * Non-region:
 * 6. Variant
 * 7. Product
 * 8. Brand
 * 9. Category
 * 10. Global
 * 
 * Highest priority + highest rule.priority wins.
 * 
 * PRIORITY RULES:
 * - Within same scope, higher priority number wins
 * - Multiple rules allowed per scope (unlike PricingRule)
 * - Highest priority rule is applied
 * 
 * CALCULATION:
 * - minSellingPrice = supplierCost + minMarkup (amount or %)
 * - maxSellingPrice = supplierCost + maxMarkup (if provided)
 */

export interface MarkupResolutionParams {
  variantId?: mongoose.Types.ObjectId | string | null;
  productId?: mongoose.Types.ObjectId | string | null;
  categoryId?: mongoose.Types.ObjectId | string | null;
  brandId?: mongoose.Types.ObjectId | string | null; // Brand ID (fetched from product if not provided)
  regionId?: mongoose.Types.ObjectId | string | null; // Region ID (optional, for region-specific rules)
  supplierCost: number; // Supplier's cost price
  appliesTo: 'reseller' | 'store'; // Where this validation is happening
}

export interface MarkupResolutionResult {
  minSellingPrice: number;
  maxSellingPrice: number | null; // null means no maximum
  appliedRuleId: string | null;
  appliedRule: any | null;
  appliedScope: 'variant' | 'product' | 'brand' | 'category' | 'global' | null;
  hasRegion: boolean; // Whether the applied rule is region-specific
}

/**
 * Resolve markup rules based on scope hierarchy and priority
 */
export async function resolveMarkupRule(
  params: MarkupResolutionParams
): Promise<MarkupResolutionResult> {
  const { variantId, productId, categoryId, brandId, regionId, supplierCost, appliesTo } = params;

  // Convert IDs to ObjectId if needed
  const variantObjId = variantId ? new mongoose.Types.ObjectId(variantId) : null;
  const productObjId = productId ? new mongoose.Types.ObjectId(productId) : null;
  const categoryObjId = categoryId ? new mongoose.Types.ObjectId(categoryId) : null;
  const brandObjId = brandId ? new mongoose.Types.ObjectId(brandId) : null;
  const regionObjId = regionId ? (typeof regionId === 'string' ? regionId : regionId.toString()) : null;

  // Fetch product to get category and brand if needed
  let productCategoryId: mongoose.Types.ObjectId | null = null;
  let productBrandId: mongoose.Types.ObjectId | null = brandObjId;
  
  if (productObjId) {
    const product = await Product.findById(productObjId).lean();
    if (product) {
      if (!categoryObjId) {
        productCategoryId = product.categoryId as mongoose.Types.ObjectId;
      } else {
        productCategoryId = categoryObjId;
      }
      // Get brandId from product if not provided
      if (!productBrandId && product.brandId) {
        productBrandId = product.brandId as mongoose.Types.ObjectId;
      }
    }
  } else if (categoryObjId) {
    productCategoryId = categoryObjId;
  }

  // Collect all applicable rules from all scopes
  // Priority: Region-specific rules first, then non-region rules
  const allRules: any[] = [];

  // REGION-SPECIFIC RULES (higher priority)
  if (regionObjId) {
    // 1. Variant + Region
    if (variantObjId) {
      const variantRegionRules = await MarkupRule.find({
        scope: 'variant',
        scopeId: variantObjId,
        regionId: regionObjId,
        status: 'active',
        appliesTo: appliesTo,
      })
        .sort({ priority: -1 })
        .lean();
      allRules.push(...variantRegionRules);
    }

    // 2. Product + Region
    if (productObjId) {
      const productRegionRules = await MarkupRule.find({
        scope: 'product',
        scopeId: productObjId,
        regionId: regionObjId,
        status: 'active',
        appliesTo: appliesTo,
      })
        .sort({ priority: -1 })
        .lean();
      allRules.push(...productRegionRules);
    }

    // 3. Brand + Region
    if (productBrandId) {
      const brandRegionRules = await MarkupRule.find({
        $or: [
          { scope: 'brand', scopeId: productBrandId, regionId: regionObjId },
          { brandId: productBrandId, regionId: regionObjId }, // Support both formats
        ],
        status: 'active',
        appliesTo: appliesTo,
      })
        .sort({ priority: -1 })
        .lean();
      allRules.push(...brandRegionRules);
    }

    // 4. Category + Region
    if (productCategoryId) {
      const categoryRegionRules = await MarkupRule.find({
        scope: 'category',
        scopeId: productCategoryId,
        regionId: regionObjId,
        status: 'active',
        appliesTo: appliesTo,
      })
        .sort({ priority: -1 })
        .lean();
      allRules.push(...categoryRegionRules);
    }

    // 5. Global + Region
    const globalRegionRules = await MarkupRule.find({
      scope: 'global',
      scopeId: null,
      regionId: regionObjId,
      status: 'active',
      appliesTo: appliesTo,
    })
      .sort({ priority: -1 })
      .lean();
    allRules.push(...globalRegionRules);
  }

  // NON-REGION RULES (lower priority, only if no region-specific rule found)
  // 6. Variant
  if (variantObjId) {
    const variantRules = await MarkupRule.find({
      scope: 'variant',
      scopeId: variantObjId,
      $or: [{ regionId: null }, { regionId: { $exists: false } }],
      status: 'active',
      appliesTo: appliesTo,
    })
      .sort({ priority: -1 })
      .lean();
    allRules.push(...variantRules);
  }

  // 7. Product
  if (productObjId) {
    const productRules = await MarkupRule.find({
      scope: 'product',
      scopeId: productObjId,
      $or: [{ regionId: null }, { regionId: { $exists: false } }],
      status: 'active',
      appliesTo: appliesTo,
    })
      .sort({ priority: -1 })
      .lean();
    allRules.push(...productRules);
  }

  // 8. Brand
  if (productBrandId) {
    const brandRules = await MarkupRule.find({
      $or: [
        { scope: 'brand', scopeId: productBrandId, $or: [{ regionId: null }, { regionId: { $exists: false } }] },
        { brandId: productBrandId, $or: [{ regionId: null }, { regionId: { $exists: false } }] },
      ],
      status: 'active',
      appliesTo: appliesTo,
    })
      .sort({ priority: -1 })
      .lean();
    allRules.push(...brandRules);
  }

  // 9. Category
  if (productCategoryId) {
    const categoryRules = await MarkupRule.find({
      scope: 'category',
      scopeId: productCategoryId,
      $or: [{ regionId: null }, { regionId: { $exists: false } }],
      status: 'active',
      appliesTo: appliesTo,
    })
      .sort({ priority: -1 })
      .lean();
    allRules.push(...categoryRules);
  }

  // 10. Global
  const globalRules = await MarkupRule.find({
    scope: 'global',
    scopeId: null,
    $or: [{ regionId: null }, { regionId: { $exists: false } }],
    status: 'active',
    appliesTo: appliesTo,
  })
    .sort({ priority: -1 })
    .lean();
  allRules.push(...globalRules);

  // If no rules found, return no constraints
  if (allRules.length === 0) {
    return {
      minSellingPrice: supplierCost, // At minimum, price should be at least cost
      maxSellingPrice: null,
      appliedRuleId: null,
      appliedRule: null,
      appliedScope: null,
      hasRegion: false,
    };
  }

  // Sort all rules by priority:
  // 1. Region-specific rules first (higher priority)
  // 2. Then by scope priority (variant > product > brand > category > global)
  // 3. Then by rule priority within same scope
  const scopePriority: Record<string, number> = {
    variant: 5,
    product: 4,
    brand: 3,
    category: 2,
    global: 1,
  };

  allRules.sort((a, b) => {
    // First: Region-specific rules win over non-region
    const aHasRegion = a.regionId !== null && a.regionId !== undefined;
    const bHasRegion = b.regionId !== null && b.regionId !== undefined;
    if (aHasRegion !== bHasRegion) {
      return bHasRegion ? 1 : -1; // Region rules first
    }
    
    // Second: Scope priority
    const scopeDiff = scopePriority[b.scope] - scopePriority[a.scope];
    if (scopeDiff !== 0) return scopeDiff;
    
    // Third: Higher priority number wins
    return b.priority - a.priority;
  });

  // Apply the highest priority rule
  const appliedRule = allRules[0];
  const appliedScope = appliedRule.scope as 'variant' | 'product' | 'brand' | 'category' | 'global';
  const hasRegion = appliedRule.regionId !== null && appliedRule.regionId !== undefined;

  // Calculate min selling price
  let minSellingPrice: number;
  if (appliedRule.minMarkupType === 'amount') {
    minSellingPrice = supplierCost + appliedRule.minMarkupValue;
  } else {
    // percentage
    minSellingPrice = supplierCost * (1 + appliedRule.minMarkupValue / 100);
  }

  // Calculate max selling price (if provided)
  let maxSellingPrice: number | null = null;
  if (
    appliedRule.maxMarkupType &&
    appliedRule.maxMarkupValue !== null &&
    appliedRule.maxMarkupValue !== undefined
  ) {
    if (appliedRule.maxMarkupType === 'amount') {
      maxSellingPrice = supplierCost + appliedRule.maxMarkupValue;
    } else {
      // percentage
      maxSellingPrice = supplierCost * (1 + appliedRule.maxMarkupValue / 100);
    }
  }

  // Round to 2 decimal places
  minSellingPrice = Math.round(minSellingPrice * 100) / 100;
  if (maxSellingPrice !== null) {
    maxSellingPrice = Math.round(maxSellingPrice * 100) / 100;
  }

  return {
    minSellingPrice,
    maxSellingPrice,
    appliedRuleId: appliedRule._id.toString(),
    appliedRule,
    appliedScope,
    hasRegion,
  };
}

/**
 * Validate if a selling price is within markup rule boundaries
 */
export async function validateMarkupRule(
  params: MarkupResolutionParams & { proposedSellingPrice: number }
): Promise<{ valid: boolean; reason?: string; markupResult: MarkupResolutionResult }> {
  const markupResult = await resolveMarkupRule(params);

  if (params.proposedSellingPrice < markupResult.minSellingPrice) {
    const minMarkup = markupResult.minSellingPrice - params.supplierCost;
    const minMarkupPercent = ((minMarkup / params.supplierCost) * 100).toFixed(2);
    return {
      valid: false,
      reason: `Minimum markup ₹${minMarkup.toFixed(2)} (${minMarkupPercent}%) required by admin rule`,
      markupResult,
    };
  }

  if (
    markupResult.maxSellingPrice !== null &&
    params.proposedSellingPrice > markupResult.maxSellingPrice
  ) {
    const maxMarkup = markupResult.maxSellingPrice - params.supplierCost;
    const maxMarkupPercent = ((maxMarkup / params.supplierCost) * 100).toFixed(2);
    return {
      valid: false,
      reason: `Maximum markup ₹${maxMarkup.toFixed(2)} (${maxMarkupPercent}%) exceeded by admin rule`,
      markupResult,
    };
  }

  return {
    valid: true,
    markupResult,
  };
}

