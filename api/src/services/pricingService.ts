import { PricingRule } from '../models/PricingRule';

/**
 * Apply global markup to base price
 * @param basePrice - Original price
 * @param markupPercent - Markup percentage (e.g., 10 for +10%)
 * @returns Final price with markup applied
 */
export const applyGlobalMarkup = (basePrice: number, markupPercent: number): number => {
  if (basePrice < 0) {
    throw new Error('Base price cannot be negative');
  }

  const markupMultiplier = 1 + markupPercent / 100;
  const finalPrice = basePrice * markupMultiplier;

  return roundPrice(finalPrice);
};

/**
 * Apply SKU-specific override markup to base price
 * @param basePrice - Original price
 * @param overridePercent - Override markup percentage
 * @returns Final price with override applied
 */
export const applySkuOverride = (basePrice: number, overridePercent: number): number => {
  if (basePrice < 0) {
    throw new Error('Base price cannot be negative');
  }

  const overrideMultiplier = 1 + overridePercent / 100;
  const finalPrice = basePrice * overrideMultiplier;

  return roundPrice(finalPrice);
};

/**
 * Round price to 2 decimal places
 * @param price - Price to round
 * @returns Rounded price
 */
export const roundPrice = (price: number): number => {
  return Math.round(price * 100) / 100;
};

/**
 * Calculate final price for a product in a store
 * Priority: SKU override > Global markup > Base price
 * 
 * @param storeId - Store ID
 * @param sku - Product SKU
 * @param basePrice - Base/supplier price
 * @returns Final calculated price
 */
export const calculateFinalPrice = async (
  storeId: string,
  sku: string,
  basePrice: number
): Promise<number> => {
  if (basePrice < 0) {
    throw new Error('Base price cannot be negative');
  }

  // Check for SKU-specific override first
  const skuOverride = await PricingRule.findOne({
    storeId,
    type: 'override',
    sku,
  });

  if (skuOverride && skuOverride.markupPercent !== undefined) {
    return applySkuOverride(basePrice, skuOverride.markupPercent);
  }

  // Check for global markup
  const globalRule = await PricingRule.findOne({
    storeId,
    type: 'global',
  });

  if (globalRule && globalRule.markupPercent !== undefined) {
    return applyGlobalMarkup(basePrice, globalRule.markupPercent);
  }

  // No pricing rules found, return base price
  return roundPrice(basePrice);
};

/**
 * Get pricing breakdown for a product
 * @param storeId - Store ID
 * @param sku - Product SKU
 * @param basePrice - Base/supplier price
 * @returns Pricing breakdown
 */
export const getPricingBreakdown = async (
  storeId: string,
  sku: string,
  basePrice: number
): Promise<{
  basePrice: number;
  finalPrice: number;
  markupPercent: number | null;
  markupType: 'global' | 'override' | 'none';
  markupAmount: number;
}> => {
  const skuOverride = await PricingRule.findOne({
    storeId,
    type: 'override',
    sku,
  });

  const globalRule = await PricingRule.findOne({
    storeId,
    type: 'global',
  });

  let finalPrice: number;
  let markupPercent: number | null = null;
  let markupType: 'global' | 'override' | 'none' = 'none';

  if (skuOverride && skuOverride.markupPercent !== undefined) {
    finalPrice = applySkuOverride(basePrice, skuOverride.markupPercent);
    markupPercent = skuOverride.markupPercent;
    markupType = 'override';
  } else if (globalRule && globalRule.markupPercent !== undefined) {
    finalPrice = applyGlobalMarkup(basePrice, globalRule.markupPercent);
    markupPercent = globalRule.markupPercent;
    markupType = 'global';
  } else {
    finalPrice = roundPrice(basePrice);
  }

  const markupAmount = finalPrice - basePrice;

  return {
    basePrice,
    finalPrice,
    markupPercent,
    markupType,
    markupAmount,
  };
};

