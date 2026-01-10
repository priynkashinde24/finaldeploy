import mongoose from 'mongoose';
import { Courier, ICourier } from '../models/Courier';
import { CourierRule, ICourierRule } from '../models/CourierRule';
import { ShippingZone } from '../models/ShippingZone';

/**
 * Courier Resolution Engine
 * 
 * PURPOSE:
 * - Map orders to the correct courier
 * - Support zone, COD, weight, price, SLA rules
 * - Allow admin override & fallback
 * - Freeze courier decision at order creation
 * - Be auditable and deterministic
 * 
 * RULES:
 * - Highest priority matching rule wins
 * - Courier must support payment method
 * - Courier must support zone
 * - Snapshot frozen after assignment
 */

export interface CourierSnapshot {
  courierId: mongoose.Types.ObjectId | string;
  courierName: string;
  courierCode: string;
  ruleId?: mongoose.Types.ObjectId | string | null;
  assignedAt: Date;
  reason: string; // Rule match explanation
}

export interface AssignCourierParams {
  storeId: mongoose.Types.ObjectId | string;
  shippingZoneId: mongoose.Types.ObjectId | string;
  orderWeight: number; // Total weight in kg
  orderValue: number; // Total order value (subtotal)
  paymentMethod: 'stripe' | 'paypal' | 'cod' | 'cod_partial';
  shippingPincode?: string; // Optional: pincode for pincode-specific couriers
}

export interface AssignCourierResult {
  snapshot: CourierSnapshot;
}

/**
 * Normalize payment method for rule matching
 */
function normalizePaymentMethod(paymentMethod: string): 'prepaid' | 'cod' {
  if (paymentMethod === 'cod' || paymentMethod === 'cod_partial') {
    return 'cod';
  }
  return 'prepaid';
}

/**
 * Check if courier is valid for assignment
 */
async function validateCourier(
  courier: ICourier,
  paymentMethod: 'prepaid' | 'cod',
  orderWeight: number,
  zoneId: mongoose.Types.ObjectId,
  pincode?: string
): Promise<{ valid: boolean; reason?: string }> {
  // Check if courier is active
  if (!courier.isActive) {
    return { valid: false, reason: 'Courier is inactive' };
  }

  // Check COD support
  if (paymentMethod === 'cod' && !courier.supportsCOD) {
    return { valid: false, reason: 'Courier does not support COD' };
  }

  // Check weight limit
  if (courier.maxWeight > 0 && orderWeight > courier.maxWeight) {
    return { valid: false, reason: `Order weight ${orderWeight} kg exceeds courier max weight ${courier.maxWeight} kg` };
  }

  // Check zone support
  const zoneObjId = typeof zoneId === 'string' ? new mongoose.Types.ObjectId(zoneId) : zoneId;
  if (!courier.serviceableZones.some((z) => z.toString() === zoneObjId.toString())) {
    return { valid: false, reason: 'Courier does not service this zone' };
  }

  // Check pincode support (if pincode-specific courier)
  if (pincode && courier.serviceablePincodes && courier.serviceablePincodes.length > 0) {
    if (!courier.serviceablePincodes.includes(pincode)) {
      return { valid: false, reason: 'Courier does not service this pincode' };
    }
  }

  return { valid: true };
}

/**
 * Check if rule matches order criteria
 */
function ruleMatches(
  rule: ICourierRule,
  paymentMethod: 'prepaid' | 'cod',
  orderWeight: number,
  orderValue: number
): boolean {
  // Check payment method
  if (rule.paymentMethod !== 'both' && rule.paymentMethod !== paymentMethod) {
    return false;
  }

  // Check weight range
  if (rule.minWeight !== null && rule.minWeight !== undefined) {
    if (orderWeight < rule.minWeight) {
      return false;
    }
  }
  if (rule.maxWeight !== null && rule.maxWeight !== undefined) {
    if (orderWeight >= rule.maxWeight) {
      return false;
    }
  }

  // Check order value range
  if (rule.minOrderValue !== null && rule.minOrderValue !== undefined) {
    if (orderValue < rule.minOrderValue) {
      return false;
    }
  }
  if (rule.maxOrderValue !== null && rule.maxOrderValue !== undefined) {
    if (orderValue >= rule.maxOrderValue) {
      return false;
    }
  }

  return true;
}

/**
 * Assign courier to order
 * 
 * Logic:
 * 1. Fetch active courier rules for zone
 * 2. Filter by payment method, weight, order value
 * 3. Validate courier (active, COD support, zone, weight)
 * 4. Sort by rule.priority → courier.priority
 * 5. Select first match
 * 6. Return CourierSnapshot
 */
export async function assignCourier(
  params: AssignCourierParams
): Promise<AssignCourierResult> {
  const { storeId, shippingZoneId, orderWeight, orderValue, paymentMethod, shippingPincode } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const zoneObjId = typeof shippingZoneId === 'string' ? new mongoose.Types.ObjectId(shippingZoneId) : shippingZoneId;
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  // Step 1: Verify zone exists
  const zone = await ShippingZone.findOne({
    _id: zoneObjId,
    storeId: storeObjId,
    isActive: true,
  }).lean();

  if (!zone) {
    throw new Error(`Shipping zone not found or inactive: ${zoneObjId}`);
  }

  // Step 2: Fetch active courier rules for zone
  const rules = await CourierRule.find({
    storeId: storeObjId,
    zoneId: zoneObjId,
    isActive: true,
  })
    .populate('courierId')
    .sort({ priority: 1 }) // Lower priority = higher priority
    .lean();

  if (rules.length === 0) {
    throw new Error(`No courier rules found for zone: ${zone.name}`);
  }

  // Step 3: Filter rules by order criteria
  const matchingRules: Array<{ rule: ICourierRule; courier: ICourier }> = [];

  for (const rule of rules) {
    // Check if rule matches
    if (!ruleMatches(rule, normalizedPaymentMethod, orderWeight, orderValue)) {
      continue;
    }

    // Get courier
    const courier = rule.courierId as any as ICourier;
    if (!courier) {
      continue;
    }

    // Validate courier
    const validation = await validateCourier(courier, normalizedPaymentMethod, orderWeight, zoneObjId, shippingPincode);
    if (!validation.valid) {
      continue;
    }

    matchingRules.push({ rule, courier });
  }

  if (matchingRules.length === 0) {
    // Try to find a default courier (fallback)
    const defaultQuery: any = {
      storeId: storeObjId,
      isActive: true,
      serviceableZones: zoneObjId,
    };
    
    if (normalizedPaymentMethod === 'cod') {
      defaultQuery.supportsCOD = true;
    }
    
    const defaultCourier = await Courier.findOne(defaultQuery)
      .sort({ priority: 1 })
      .lean();

    if (defaultCourier) {
      const validation = await validateCourier(
        defaultCourier,
        normalizedPaymentMethod,
        orderWeight,
        zoneObjId,
        shippingPincode
      );

      if (validation.valid) {
        const snapshot: CourierSnapshot = {
          courierId: defaultCourier._id,
          courierName: defaultCourier.name,
          courierCode: defaultCourier.code,
          ruleId: null,
          assignedAt: new Date(),
          reason: `Default courier (no matching rules found)`,
        };

        return { snapshot };
      }
    }

    throw new Error(
      `No courier found for zone "${zone.name}" with payment method "${normalizedPaymentMethod}", weight ${orderWeight} kg, order value ₹${orderValue}`
    );
  }

  // Step 4: Sort by rule priority, then courier priority
  matchingRules.sort((a, b) => {
    // First by rule priority (lower = higher priority)
    if (a.rule.priority !== b.rule.priority) {
      return a.rule.priority - b.rule.priority;
    }
    // Then by courier priority (lower = higher priority)
    return a.courier.priority - b.courier.priority;
  });

  // Step 5: Select first match
  const selected = matchingRules[0];
  const { rule, courier } = selected;

  // Build reason string
  const reasonParts: string[] = [];
  reasonParts.push(`Rule priority ${rule.priority}`);
  if (rule.minWeight !== null || rule.maxWeight !== null) {
    reasonParts.push(`weight ${rule.minWeight || 0}-${rule.maxWeight || '∞'} kg`);
  }
  if (rule.minOrderValue !== null || rule.maxOrderValue !== null) {
    reasonParts.push(`value ₹${rule.minOrderValue || 0}-${rule.maxOrderValue || '∞'}`);
  }
  reasonParts.push(`courier priority ${courier.priority}`);

  const snapshot: CourierSnapshot = {
    courierId: courier._id,
    courierName: courier.name,
    courierCode: courier.code,
    ruleId: rule._id,
    assignedAt: new Date(),
    reason: reasonParts.join(', '),
  };

  return { snapshot };
}

/**
 * Get available couriers for a zone (for admin UI)
 */
export async function getAvailableCouriers(
  storeId: mongoose.Types.ObjectId | string,
  zoneId: mongoose.Types.ObjectId | string,
  paymentMethod: 'prepaid' | 'cod',
  orderWeight: number,
  orderValue: number
): Promise<ICourier[]> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const zoneObjId = typeof zoneId === 'string' ? new mongoose.Types.ObjectId(zoneId) : zoneId;

  const couriers = await Courier.find({
    storeId: storeObjId,
    isActive: true,
    serviceableZones: zoneObjId,
    supportsCOD: paymentMethod === 'cod' ? true : undefined,
  })
    .sort({ priority: 1 })
    .lean();

  // Filter by weight limit
  const validCouriers = couriers.filter((courier) => {
    if (courier.maxWeight > 0 && orderWeight > courier.maxWeight) {
      return false;
    }
    return true;
  });

  return validCouriers;
}

