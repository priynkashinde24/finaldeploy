import mongoose from 'mongoose';
import { ShippingZone, IShippingZone } from '../models/ShippingZone';
import { ShippingRate, IShippingRate } from '../models/ShippingRate';
import { roundPrice } from '../services/pricingService';

/**
 * Shipping Engine
 * 
 * PURPOSE:
 * - Calculate shipping cost deterministically
 * - Support zones, weight slabs, order value slabs
 * - Handle COD surcharges
 * - Be snapshot-based (never recalc after order)
 * 
 * RULES:
 * - Zone resolution priority: pincode → state → country
 * - Non-overlapping slabs per zone
 * - Inclusive min, exclusive max
 * - One matching slab per request
 * - Snapshot frozen at order creation
 */

export interface ShippingSnapshot {
  zoneId: mongoose.Types.ObjectId | string;
  zoneName: string;
  rateType: 'weight' | 'order_value';
  slab: {
    min: number;
    max: number;
  };
  baseRate: number;
  variableRate: number; // unit * perUnitRate
  codSurcharge: number;
  totalShipping: number; // baseRate + variableRate + codSurcharge
  calculatedAt: Date;
}

export interface CalculateShippingParams {
  storeId: mongoose.Types.ObjectId | string;
  shippingAddress: {
    country: string;
    state?: string;
    zip?: string; // pincode/postal code
  };
  orderWeight: number; // Total weight in kg
  orderValue: number; // Total order value (subtotal after discounts)
  paymentMethod: 'stripe' | 'paypal' | 'cod' | 'cod_partial';
}

export interface CalculateShippingResult {
  snapshot: ShippingSnapshot;
}

/**
 * Resolve shipping zone for an address
 * Priority: pincode → state → country
 */
async function resolveShippingZone(
  storeId: mongoose.Types.ObjectId,
  countryCode: string,
  stateCode?: string,
  pincode?: string
): Promise<IShippingZone | null> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const country = countryCode.toUpperCase();

  // Priority 1: Match by pincode
  if (pincode) {
    const zoneByPincode = await ShippingZone.findOne({
      storeId: storeObjId,
      countryCode: country,
      pincodes: { $in: [pincode] },
      isActive: true,
    }).lean();

    if (zoneByPincode) {
      return zoneByPincode;
    }
  }

  // Priority 2: Match by state
  if (stateCode) {
    const zoneByState = await ShippingZone.findOne({
      storeId: storeObjId,
      countryCode: country,
      stateCodes: { $in: [stateCode] },
      isActive: true,
    }).lean();

    if (zoneByState) {
      return zoneByState;
    }
  }

  // Priority 3: Match by country (fallback) - zones with no state/pincode restrictions
  // Find zones where stateCodes and pincodes are empty or don't exist
  const allZones = await ShippingZone.find({
    storeId: storeObjId,
    countryCode: country,
    isActive: true,
  }).lean();

  // Filter for zones with no state/pincode restrictions
  const zoneByCountry = allZones.find(
    (zone) =>
      (!zone.stateCodes || zone.stateCodes.length === 0) &&
      (!zone.pincodes || zone.pincodes.length === 0)
  );

  return zoneByCountry || null;
}

/**
 * Find matching rate slab for a zone
 */
async function findMatchingRate(
  storeId: mongoose.Types.ObjectId,
  zoneId: mongoose.Types.ObjectId,
  rateType: 'weight' | 'order_value',
  value: number
): Promise<IShippingRate | null> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const zoneObjId = typeof zoneId === 'string' ? new mongoose.Types.ObjectId(zoneId) : zoneId;

  const rate = await ShippingRate.findOne({
    storeId: storeObjId,
    zoneId: zoneObjId,
    rateType,
    minValue: { $lte: value },
    maxValue: { $gt: value },
    isActive: true,
  }).lean();

  return rate;
}

/**
 * Calculate shipping cost
 * 
 * This function:
 * - Resolves shipping zone
 * - Selects rate slab based on weight OR order value
 * - Calculates shipping = baseRate + (unit * perUnitRate)
 * - Adds COD surcharge if COD
 * - Creates immutable snapshot
 */
export async function calculateShipping(
  params: CalculateShippingParams
): Promise<CalculateShippingResult> {
  const { storeId, shippingAddress, orderWeight, orderValue, paymentMethod } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // Step 1: Resolve shipping zone
  const zone = await resolveShippingZone(
    storeObjId,
    shippingAddress.country,
    shippingAddress.state,
    shippingAddress.zip
  );

  if (!zone) {
    throw new Error(
      `No shipping zone found for address: ${shippingAddress.country}${shippingAddress.state ? `, ${shippingAddress.state}` : ''}${shippingAddress.zip ? `, ${shippingAddress.zip}` : ''}`
    );
  }

  // Step 2: Select rate type (prefer weight if available, fallback to order_value)
  let rateType: 'weight' | 'order_value' = 'order_value';
  let rateValue = orderValue;
  let rate: IShippingRate | null = null;

  // Try weight-based rate first
  const weightRate = await findMatchingRate(storeObjId, zone._id, 'weight', orderWeight);
  if (weightRate) {
    rateType = 'weight';
    rateValue = orderWeight;
    rate = weightRate;
  } else {
    // Fallback to order value
    const valueRate = await findMatchingRate(storeObjId, zone._id, 'order_value', orderValue);
    if (!valueRate) {
      throw new Error(
        `No shipping rate slab found for zone "${zone.name}" with weight = ${orderWeight} kg or order value = ₹${orderValue}`
      );
    }
    rate = valueRate;
  }

  if (!rate) {
    throw new Error(
      `No shipping rate slab found for zone "${zone.name}" with ${rateType} = ${rateValue}`
    );
  }

  // Step 3: Calculate shipping
  // Variable component: (value - minValue) * perUnitRate
  const excessUnits = rateValue - rate.minValue;
  const variableRate = roundPrice(excessUnits * rate.perUnitRate);

  // Base rate
  const baseRate = roundPrice(rate.baseRate);

  // COD surcharge (only if COD payment)
  const codSurcharge =
    paymentMethod === 'cod' || paymentMethod === 'cod_partial'
      ? roundPrice(rate.codSurcharge)
      : 0;

  // Total shipping
  const totalShipping = roundPrice(baseRate + variableRate + codSurcharge);

  // Step 4: Create snapshot
  const snapshot: ShippingSnapshot = {
    zoneId: zone._id,
    zoneName: zone.name,
    rateType,
    slab: {
      min: rate.minValue,
      max: rate.maxValue,
    },
    baseRate,
    variableRate,
    codSurcharge,
    totalShipping,
    calculatedAt: new Date(),
  };

  return { snapshot };
}

/**
 * Get shipping zone for an address (for preview/checkout)
 */
export async function getShippingZone(
  storeId: mongoose.Types.ObjectId | string,
  shippingAddress: {
    country: string;
    state?: string;
    zip?: string;
  }
): Promise<IShippingZone | null> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  return resolveShippingZone(storeObjId, shippingAddress.country, shippingAddress.state, shippingAddress.zip);
}

