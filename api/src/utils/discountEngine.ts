import mongoose from 'mongoose';
import { Coupon } from '../models/Coupon';
import { Promotion } from '../models/Promotion';
import { Product } from '../models/Product';
import { resolvePricingRules } from './pricingEngine';

/**
 * Discount Engine Utility
 * 
 * PURPOSE:
 * - Resolve discounts (promotions and coupons)
 * - Apply discounts safely
 * - Validate final price against pricing rules
 * - Return discount breakdown
 * 
 * LOGIC:
 * 1. Apply Promotion (if valid)
 * 2. Apply Coupon (if provided)
 * 3. Calculate final discounted price
 * 4. Validate via pricingEngine
 * 5. Return final price and breakdown
 */

export interface DiscountResolutionParams {
  baseSellingPrice: number; // Base selling price (may be dynamically adjusted)
  productId: mongoose.Types.ObjectId | string;
  variantId?: mongoose.Types.ObjectId | string | null;
  categoryId?: mongoose.Types.ObjectId | string | null;
  supplierCost: number; // Supplier cost (for margin validation)
  couponCode?: string | null; // Optional coupon code
  customerEmail?: string; // For per-user coupon limits
  orderValue?: number; // Total order value (for min order value checks)
}

export interface DiscountBreakdown {
  basePrice: number;
  promotionDiscount?: number;
  promotionId?: string;
  couponDiscount?: number;
  couponId?: string;
  totalDiscount: number;
  finalPrice: number;
  pricingRuleValidated: boolean;
  pricingRuleViolations?: string[];
}

export interface DiscountResolutionResult {
  success: boolean;
  finalPrice: number;
  discountBreakdown: DiscountBreakdown;
  error?: string;
}

/**
 * Resolve discounts for a product
 */
export async function resolveDiscount(
  params: DiscountResolutionParams
): Promise<DiscountResolutionResult> {
  const {
    baseSellingPrice,
    productId,
    variantId,
    categoryId,
    supplierCost,
    couponCode,
    customerEmail,
    orderValue,
  } = params;

  const breakdown: DiscountBreakdown = {
    basePrice: baseSellingPrice,
    totalDiscount: 0,
    finalPrice: baseSellingPrice,
    pricingRuleValidated: false,
  };

  let currentPrice = baseSellingPrice;

  // Step 1: Apply Promotion (if valid)
  // Find active promotions that apply to this product
  const now = new Date();
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

  // Find applicable promotions (priority: variant → product → category)
  const promotions: any[] = [];

  // Variant promotion
  if (variantObjId) {
    const variantPromo = await Promotion.findOne({
      applicableScope: 'variant',
      scopeId: variantObjId,
      status: 'active',
      validFrom: { $lte: now },
      validTo: { $gte: now },
    }).lean();
    if (variantPromo) {
      promotions.push(variantPromo);
    }
  }

  // Product promotion
  const productPromo = await Promotion.findOne({
    applicableScope: 'product',
    scopeId: productObjId,
    status: 'active',
    validFrom: { $lte: now },
    validTo: { $gte: now },
  }).lean();
  if (productPromo) {
    promotions.push(productPromo);
  }

  // Category promotion
  if (productCategoryId) {
    const categoryPromo = await Promotion.findOne({
      applicableScope: 'category',
      scopeId: productCategoryId,
      status: 'active',
      validFrom: { $lte: now },
      validTo: { $gte: now },
    }).lean();
    if (categoryPromo) {
      promotions.push(categoryPromo);
    }
  }

  // Apply the first promotion found (highest priority)
  if (promotions.length > 0) {
    const promotion = promotions[0];
    let promoDiscount = 0;

    if (promotion.discountType === 'percentage') {
      promoDiscount = (currentPrice * promotion.discountValue) / 100;
      if (promotion.maxDiscountAmount !== null && promoDiscount > promotion.maxDiscountAmount) {
        promoDiscount = promotion.maxDiscountAmount;
      }
    } else {
      promoDiscount = promotion.discountValue;
    }

    // Ensure discount doesn't exceed price
    promoDiscount = Math.min(promoDiscount, currentPrice);
    currentPrice = currentPrice - promoDiscount;

    breakdown.promotionDiscount = promoDiscount;
    breakdown.promotionId = promotion._id.toString();
  }

  // Step 2: Apply Coupon (if provided)
  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      status: 'active',
    });

    if (!coupon) {
      return {
        success: false,
        finalPrice: currentPrice,
        discountBreakdown: breakdown,
        error: 'Invalid coupon code',
      };
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      return {
        success: false,
        finalPrice: currentPrice,
        discountBreakdown: breakdown,
        error: 'Coupon is expired or inactive',
      };
    }

    // Check if coupon applies to this product
    let couponApplies = false;
    if (coupon.applicableScope === 'global') {
      couponApplies = true;
    } else if (coupon.applicableScope === 'variant' && variantObjId) {
      couponApplies = coupon.scopeId?.toString() === variantObjId.toString();
    } else if (coupon.applicableScope === 'product') {
      couponApplies = coupon.scopeId?.toString() === productObjId.toString();
    } else if (coupon.applicableScope === 'category' && productCategoryId) {
      couponApplies = coupon.scopeId?.toString() === productCategoryId.toString();
    }

    if (!couponApplies) {
      return {
        success: false,
        finalPrice: currentPrice,
        discountBreakdown: breakdown,
        error: 'Coupon does not apply to this product',
      };
    }

    // Check user eligibility
    if (customerEmail) {
      const canUse = await coupon.canBeUsedByUser(customerEmail, orderValue || 0);
      if (!canUse.canUse) {
        return {
          success: false,
          finalPrice: currentPrice,
          discountBreakdown: breakdown,
          error: canUse.reason || 'Cannot use this coupon',
        };
      }
    }

    // Check minimum order value
    if (coupon.minOrderValue !== null && coupon.minOrderValue !== undefined && (orderValue || 0) < coupon.minOrderValue) {
      return {
        success: false,
        finalPrice: currentPrice,
        discountBreakdown: breakdown,
        error: `Minimum order value of ₹${coupon.minOrderValue} required`,
      };
    }

    // Calculate coupon discount
    let couponDiscount = 0;
    if (coupon.discountType === 'percentage') {
      couponDiscount = (currentPrice * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined && couponDiscount > coupon.maxDiscountAmount) {
        couponDiscount = coupon.maxDiscountAmount;
      }
    } else {
      couponDiscount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed price
    couponDiscount = Math.min(couponDiscount, currentPrice);
    currentPrice = currentPrice - couponDiscount;

    breakdown.couponDiscount = couponDiscount;
    breakdown.couponId = coupon._id.toString();
  }

  // Step 3: Calculate final discounted price
  breakdown.totalDiscount = breakdown.basePrice - currentPrice;
  breakdown.finalPrice = currentPrice;

  // Step 4: Validate via pricingEngine
  const pricingResolution = await resolvePricingRules({
    productId,
    variantId: variantObjId || null,
    categoryId: productCategoryId,
    supplierCost,
    proposedSellingPrice: currentPrice,
    enforceOn: 'storefront',
  });

  breakdown.pricingRuleValidated = pricingResolution.allowed;
  if (!pricingResolution.allowed) {
    breakdown.pricingRuleViolations = pricingResolution.violations;
    return {
      success: false,
      finalPrice: currentPrice,
      discountBreakdown: breakdown,
      error: `Discount violates pricing rules: ${pricingResolution.violations.join('. ')}`,
    };
  }

  // Step 5: Return success
  return {
    success: true,
    finalPrice: currentPrice,
    discountBreakdown: breakdown,
  };
}

