import mongoose from 'mongoose';
import { StorePriceOverride } from '../models/StorePriceOverride';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { resolvePricingRules } from './pricingEngine';

/**
 * Store Price Engine Utility
 * 
 * PURPOSE:
 * - Apply store-specific price overrides
 * - Resolve override priority (variant → product → category)
 * - Validate overrides against admin pricing rules
 * - Support fixed price and price delta adjustments
 * 
 * PRICE RESOLUTION ORDER:
 * 1. Base reseller selling price
 * 2. Store price override (THIS STEP)
 * 3. Dynamic pricing
 * 4. Promotions
 * 5. Coupons
 * 6. Admin pricing rule validation
 * 7. Tax calculation
 * 
 * SAFETY RULES:
 * - Overrides cannot push price below admin min price
 * - Overrides cannot exceed admin max price
 * - Overrides never affect other stores
 * - Disable override = instant fallback
 */

export interface StoreOverrideParams {
  basePrice: number; // Base reseller selling price
  storeId: mongoose.Types.ObjectId | string;
  productId: mongoose.Types.ObjectId | string;
  variantId?: mongoose.Types.ObjectId | string | null;
  categoryId?: mongoose.Types.ObjectId | string | null;
  supplierCost?: number; // For validation against admin pricing rules
}

export interface StoreOverrideResult {
  overriddenPrice: number; // Price after store override
  appliedOverrideId?: string; // ID of the override that was applied
  appliedOverride?: any; // Full override object
  wasOverridden: boolean; // Whether an override was applied
  validationPassed: boolean; // Whether override passed admin pricing rule validation
  validationErrors: string[]; // Any validation errors
}

/**
 * Apply store price override
 * 
 * Priority: Variant → Product → Category
 */
export async function applyStoreOverride(
  params: StoreOverrideParams
): Promise<StoreOverrideResult> {
  const { basePrice, storeId, productId, variantId, categoryId, supplierCost } = params;

  const storeObjId = new mongoose.Types.ObjectId(storeId);
  const productObjId = new mongoose.Types.ObjectId(productId);
  const variantObjId = variantId ? new mongoose.Types.ObjectId(variantId) : null;
  const categoryObjId = categoryId ? new mongoose.Types.ObjectId(categoryId) : null;

  // Get product category if not provided
  let productCategoryId: mongoose.Types.ObjectId | null = null;
  if (!categoryObjId) {
    const product = await Product.findById(productObjId).lean();
    if (product) {
      productCategoryId = product.categoryId as mongoose.Types.ObjectId;
    }
  } else {
    productCategoryId = categoryObjId;
  }

  // Resolve override in priority order: Variant → Product → Category
  let appliedOverride: any = null;

  // Priority 1: Variant override
  if (variantObjId) {
    const variantOverride = await StorePriceOverride.findOne({
      storeId: storeObjId,
      scope: 'variant',
      scopeId: variantObjId,
      status: 'active',
    }).lean();

    if (variantOverride) {
      appliedOverride = variantOverride;
    }
  }

  // Priority 2: Product override (if no variant override)
  if (!appliedOverride) {
    const productOverride = await StorePriceOverride.findOne({
      storeId: storeObjId,
      scope: 'product',
      scopeId: productObjId,
      status: 'active',
    }).lean();

    if (productOverride) {
      appliedOverride = productOverride;
    }
  }

  // Priority 3: Category override (if no variant/product override)
  if (!appliedOverride && productCategoryId) {
    const categoryOverride = await StorePriceOverride.findOne({
      storeId: storeObjId,
      scope: 'category',
      scopeId: productCategoryId,
      status: 'active',
    }).lean();

    if (categoryOverride) {
      appliedOverride = categoryOverride;
    }
  }

  // If no override found, return base price
  if (!appliedOverride) {
    return {
      overriddenPrice: basePrice,
      wasOverridden: false,
      validationPassed: true,
      validationErrors: [],
    };
  }

  // Apply override
  let overriddenPrice: number;

  if (appliedOverride.overrideType === 'fixed_price') {
    // Fixed price: use override value directly
    overriddenPrice = appliedOverride.overrideValue;
  } else {
    // Price delta: adjust base price
    // If overrideValue is positive, it's a percentage increase
    // If overrideValue is negative, it's a percentage decrease
    // If overrideValue is between -1 and 1, treat as percentage
    // Otherwise, treat as absolute amount
    if (Math.abs(appliedOverride.overrideValue) <= 1) {
      // Percentage (e.g., 0.1 = 10%, -0.05 = -5%)
      overriddenPrice = basePrice * (1 + appliedOverride.overrideValue);
    } else if (Math.abs(appliedOverride.overrideValue) <= 100) {
      // Percentage (e.g., 10 = 10%, -5 = -5%)
      overriddenPrice = basePrice * (1 + appliedOverride.overrideValue / 100);
    } else {
      // Absolute amount (e.g., 50 = +₹50, -20 = -₹20)
      overriddenPrice = basePrice + appliedOverride.overrideValue;
    }
  }

  // Ensure price is non-negative
  overriddenPrice = Math.max(0, overriddenPrice);
  overriddenPrice = Math.round(overriddenPrice * 100) / 100;

  // Validate against admin pricing rules (if supplier cost provided)
  const validationErrors: string[] = [];
  let validationPassed = true;

  if (supplierCost !== undefined && supplierCost !== null) {
    const pricingValidation = await resolvePricingRules({
      productId: productObjId,
      variantId: variantObjId || null,
      categoryId: productCategoryId,
      supplierCost,
      proposedSellingPrice: overriddenPrice,
      enforceOn: 'storefront', // Store overrides apply to storefront
    });

    if (!pricingValidation.allowed) {
      validationPassed = false;
      validationErrors.push(...pricingValidation.violations);

      // Clamp price to allowed range if validation failed
      if (overriddenPrice < pricingValidation.finalAllowedPriceRange.min) {
        overriddenPrice = pricingValidation.finalAllowedPriceRange.min;
      }
      if (
        pricingValidation.finalAllowedPriceRange.max !== null &&
        overriddenPrice > pricingValidation.finalAllowedPriceRange.max
      ) {
        overriddenPrice = pricingValidation.finalAllowedPriceRange.max;
      }
    }
  }

  return {
    overriddenPrice,
    appliedOverrideId: appliedOverride._id.toString(),
    appliedOverride,
    wasOverridden: true,
    validationPassed,
    validationErrors,
  };
}

/**
 * Resolve store by code
 */
export async function resolveStoreByCode(storeCode: string): Promise<{
  store: any;
  storeId: string | null;
}> {
  const { Store } = await import('../models/Store');
  const store = await Store.findOne({
    code: storeCode.toUpperCase(),
    status: { $in: ['active', 'draft'] }, // Allow both active and draft stores
  }).lean();

  if (!store) {
    return { store: null, storeId: null };
  }

  return { store, storeId: store._id.toString() };
}

