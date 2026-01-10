import { Coupon, ICoupon } from '../models/Coupon';
import { CouponRedemption } from '../models/CouponRedemption';

export interface CartItem {
  productId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
}

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discountAmount?: number;
  coupon?: ICoupon;
}

/**
 * Calculate cart subtotal
 */
const calculateSubtotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
};

/**
 * Check if coupon is within valid date range
 */
const isCouponActive = (coupon: ICoupon): boolean => {
  if (!coupon.active) {
    return false;
  }

  const now = new Date();

  if (coupon.startsAt && now < coupon.startsAt) {
    return false;
  }

  if (coupon.endsAt && now > coupon.endsAt) {
    return false;
  }

  return true;
};

/**
 * Check if cart meets minimum order requirement
 */
const meetsMinimumOrder = (coupon: ICoupon, cartSubtotal: number): boolean => {
  if (!coupon.conditions || !coupon.conditions.minOrder) {
    return true;
  }

  return cartSubtotal >= coupon.conditions.minOrder;
};

/**
 * Check if cart contains required product SKUs
 */
const containsRequiredSkus = (coupon: ICoupon, cartItems: CartItem[]): boolean => {
  if (!coupon.conditions || !coupon.conditions.productSkus || coupon.conditions.productSkus.length === 0) {
    return true;
  }

  const cartSkus = cartItems.map((item) => item.sku);
  return coupon.conditions.productSkus.some((sku: string) => cartSkus.includes(sku));
};

/**
 * Check usage limits
 */
const checkUsageLimits = async (
  coupon: ICoupon,
  userId: string
): Promise<{ valid: boolean; reason?: string }> => {
  // Check max redemptions
  if (coupon.conditions?.maxRedemptions) {
    const totalRedemptions = await CouponRedemption.countDocuments({ couponId: coupon.couponId });
    if (totalRedemptions >= coupon.conditions.maxRedemptions) {
      return { valid: false, reason: 'Coupon has reached maximum redemptions' };
    }
  }

  // Check per-user limit
  if (coupon.conditions?.usageLimitPerUser) {
    const userRedemptions = await CouponRedemption.countDocuments({
      couponId: coupon.couponId,
      userId,
    });
    if (userRedemptions >= coupon.conditions.usageLimitPerUser) {
      return { valid: false, reason: 'You have reached the usage limit for this coupon' };
    }
  }

  return { valid: true };
};

/**
 * Calculate discount amount for percent coupon
 */
const calculatePercentDiscount = (coupon: ICoupon, cartSubtotal: number): number => {
  const value = coupon.value ?? coupon.discountValue;
  const discount = (cartSubtotal * value) / 100;
  return Math.round(discount * 100) / 100;
};

/**
 * Calculate discount amount for fixed coupon
 */
const calculateFixedDiscount = (coupon: ICoupon, cartSubtotal: number): number => {
  // Fixed discount cannot exceed cart subtotal
  const value = coupon.value ?? coupon.discountValue;
  return Math.min(value, cartSubtotal);
};

/**
 * Calculate discount for BOGO coupon
 */
const calculateBOGODiscount = (coupon: ICoupon, cartItems: CartItem[]): number => {
  // BOGO: Buy one, get one free
  // Find items matching the SKU restriction
  let discount = 0;

  if (coupon.conditions?.productSkus && coupon.conditions.productSkus.length > 0) {
    // Apply BOGO to matching SKUs
    coupon.conditions.productSkus.forEach((sku: string) => {
      const matchingItem = cartItems.find((item) => item.sku === sku);
      if (matchingItem && matchingItem.quantity >= 2) {
        // For every 2 items, 1 is free
        const freeQuantity = Math.floor(matchingItem.quantity / 2);
        discount += freeQuantity * matchingItem.unitPrice;
      }
    });
  } else {
    // No SKU restriction - apply to first item in cart
    if (cartItems.length > 0) {
      const firstItem = cartItems[0];
      if (firstItem.quantity >= 2) {
        const freeQuantity = Math.floor(firstItem.quantity / 2);
        discount += freeQuantity * firstItem.unitPrice;
      }
    }
  }

  return Math.round(discount * 100) / 100;
};

/**
 * Calculate discount for tiered coupon
 */
const calculateTieredDiscount = (coupon: ICoupon, cartSubtotal: number): number => {
  // Tiered: e.g., spend >= 100 => 10% off, spend >= 200 => 20% off
  // For simplicity, we'll use value as the percentage when minOrder is met
  // In production, this would be more complex with multiple tiers
  if (coupon.conditions?.minOrder && cartSubtotal >= coupon.conditions.minOrder) {
    return calculatePercentDiscount(coupon, cartSubtotal);
  }

  return 0;
};

/**
 * Apply coupon to cart and calculate discount
 */
export const applyCoupon = (cart: Cart, coupon: ICoupon): number => {
  const cartSubtotal = cart.subtotal || calculateSubtotal(cart.items);

  let discountAmount = 0;

  switch (coupon.type) {
    case 'percent':
      discountAmount = calculatePercentDiscount(coupon, cartSubtotal);
      break;

    case 'fixed':
      discountAmount = calculateFixedDiscount(coupon, cartSubtotal);
      break;

    case 'bogo':
      discountAmount = calculateBOGODiscount(coupon, cart.items);
      break;

    case 'tiered':
      discountAmount = calculateTieredDiscount(coupon, cartSubtotal);
      break;

    default:
      discountAmount = 0;
  }

  return discountAmount;
};

/**
 * Validate coupon and return discount amount
 */
export const validateCoupon = async (
  storeId: string,
  code: string,
  cart: Cart,
  userId?: string
): Promise<CouponValidationResult> => {
  // Find coupon
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    storeId,
  });

  if (!coupon) {
    return {
      valid: false,
      reason: 'Coupon code not found',
    };
  }

  // Check if coupon is active
  if (!isCouponActive(coupon)) {
    return {
      valid: false,
      reason: 'Coupon is not active or has expired',
    };
  }

  // Calculate cart subtotal
  const cartSubtotal = cart.subtotal || calculateSubtotal(cart.items);

  // Check minimum order
  if (!meetsMinimumOrder(coupon, cartSubtotal)) {
    return {
      valid: false,
      reason: `Minimum order of $${coupon.conditions?.minOrder || coupon.minOrderValue || 0} required`,
    };
  }

  // Check required SKUs
  if (!containsRequiredSkus(coupon, cart.items)) {
    return {
      valid: false,
      reason: 'Cart does not contain required products',
    };
  }

  // Check usage limits (if userId provided)
  if (userId) {
    const usageCheck = await checkUsageLimits(coupon, userId);
    if (!usageCheck.valid) {
      return {
        valid: false,
        reason: usageCheck.reason,
      };
    }
  }

  // Calculate discount amount
  const discountAmount = applyCoupon(cart, coupon);

  return {
    valid: true,
    discountAmount,
    coupon,
  };
};

