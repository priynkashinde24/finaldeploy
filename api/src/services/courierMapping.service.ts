import mongoose from 'mongoose';
import { Courier, ICourier } from '../models/Courier';
import { CourierMapping, ICourierMapping, CourierMappingType, CourierMappingPriority } from '../models/CourierMapping';
import { ShippingZone } from '../models/ShippingZone';
import { RMA, IRMA } from '../models/RMA';
import { Order } from '../models/Order';

/**
 * Courier Mapping Service
 * 
 * PURPOSE:
 * - Map couriers for Logistics (outbound shipping)
 * - Map couriers for Returns (reverse logistics)
 * - Map couriers for CRM (customer service scenarios)
 * - Support multiple selection criteria
 * - Provide fallback options
 */

export interface LogisticsMappingParams {
  storeId: mongoose.Types.ObjectId | string;
  shippingZoneId: mongoose.Types.ObjectId | string;
  orderWeight: number;
  orderValue: number;
  paymentMethod: 'prepaid' | 'cod' | 'both';
  shippingPincode?: string;
  priority?: CourierMappingPriority;
}

export interface ReturnsMappingParams {
  storeId: mongoose.Types.ObjectId | string;
  rmaId?: mongoose.Types.ObjectId | string;
  returnReason?: string;
  itemCondition?: 'sealed' | 'opened' | 'damaged';
  returnValue?: number;
  originZoneId?: mongoose.Types.ObjectId | string; // Origin warehouse zone
  customerZoneId?: mongoose.Types.ObjectId | string; // Customer location zone
  requiresPickup: boolean;
  priority?: CourierMappingPriority;
}

export interface CRMMappingParams {
  storeId: mongoose.Types.ObjectId | string;
  scenario: 'support_ticket' | 'document_delivery' | 'replacement' | 'warranty';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  customerTier?: 'standard' | 'premium' | 'vip';
  destinationZoneId?: mongoose.Types.ObjectId | string;
  weight?: number;
  value?: number;
  priority?: CourierMappingPriority;
}

export interface CourierMappingResult {
  courier: ICourier;
  mappingId: mongoose.Types.ObjectId | string;
  reason: string;
  score?: number;
  fallbackCourier?: ICourier;
}

/**
 * Map courier for Logistics (outbound shipping)
 */
export async function mapCourierForLogistics(
  params: LogisticsMappingParams
): Promise<CourierMappingResult> {
  const {
    storeId,
    shippingZoneId,
    orderWeight,
    orderValue,
    paymentMethod,
    shippingPincode,
    priority = 'cost',
  } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const zoneObjId = typeof shippingZoneId === 'string' ? new mongoose.Types.ObjectId(shippingZoneId) : shippingZoneId;

  // Find matching mappings
  const mappings = await CourierMapping.find({
    storeId: storeObjId,
    mappingType: 'logistics',
    isActive: true,
    shippingZoneId: zoneObjId,
  })
    .populate('courierId')
    .populate('fallbackCourierId')
    .sort({ priority: 1 })
    .lean();

  // Filter mappings by criteria
  const matchingMappings: Array<{ mapping: ICourierMapping; score: number }> = [];

  for (const mapping of mappings) {
    // Check payment method
    if (mapping.paymentMethod && mapping.paymentMethod !== 'both' && mapping.paymentMethod !== paymentMethod) {
      continue;
    }

    // Check weight
    if (mapping.minWeight !== null && mapping.minWeight !== undefined && orderWeight < mapping.minWeight) {
      continue;
    }
    if (mapping.maxWeight !== null && mapping.maxWeight !== undefined && orderWeight > mapping.maxWeight) {
      continue;
    }

    // Check order value
    if (mapping.minOrderValue !== null && mapping.minOrderValue !== undefined && orderValue < mapping.minOrderValue) {
      continue;
    }
    if (mapping.maxOrderValue !== null && mapping.maxOrderValue !== undefined && orderValue > mapping.maxOrderValue) {
      continue;
    }

    // Check conditions (time, day, etc.)
    if (!checkConditions(mapping)) {
      continue;
    }

    // Get courier
    const courier = mapping.courierId as any as ICourier;
    if (!courier || !courier.isActive) {
      continue;
    }

    // Validate courier
    const validation = validateCourierForLogistics(courier, paymentMethod, orderWeight, zoneObjId, shippingPincode);
    if (!validation.valid) {
      continue;
    }

    // Calculate score based on priority
    const score = calculateScore(courier, mapping, priority, orderWeight, orderValue);

    matchingMappings.push({ mapping, score });
  }

  if (matchingMappings.length === 0) {
    // Fallback: Use default courier engine
    const { assignCourier } = await import('../utils/courierEngine');
    // Map payment method: 'prepaid' -> 'stripe', 'cod' -> 'cod', 'both' -> 'stripe'
    const mappedPaymentMethod = paymentMethod === 'both' || paymentMethod === 'prepaid' ? 'stripe' : 'cod';
    const result = await assignCourier({
      storeId,
      shippingZoneId,
      orderWeight,
      orderValue,
      paymentMethod: mappedPaymentMethod,
      shippingPincode,
    });

    const courier = await Courier.findById(result.snapshot.courierId).lean();
    if (!courier) {
      throw new Error('No courier found for logistics');
    }

    return {
      courier,
      mappingId: result.snapshot.ruleId || 'default',
      reason: result.snapshot.reason || 'Default courier assignment',
    };
  }

  // Sort by score (higher is better)
  matchingMappings.sort((a, b) => b.score - a.score);

  const selected = matchingMappings[0];
  const courier = selected.mapping.courierId as any as ICourier;
  const fallback = selected.mapping.fallbackCourierId as any as ICourier | undefined;

  return {
    courier,
    mappingId: selected.mapping._id,
    reason: `Logistics mapping: ${selected.mapping.name} (priority: ${priority})`,
    score: selected.score,
    fallbackCourier: fallback && fallback.isActive ? fallback : undefined,
  };
}

/**
 * Map courier for Returns (reverse logistics)
 */
export async function mapCourierForReturns(
  params: ReturnsMappingParams
): Promise<CourierMappingResult> {
  const {
    storeId,
    rmaId,
    returnReason,
    itemCondition,
    returnValue,
    originZoneId,
    customerZoneId,
    requiresPickup,
    priority = 'cost',
  } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // Get RMA details if provided
  let rma: IRMA | null = null;
  let resolvedOriginZoneId = originZoneId;
  
  if (rmaId) {
    rma = await RMA.findById(rmaId).populate('orderId').lean();
    if (rma) {
      const order = rma.orderId as any;
      if (order && order.shippingSnapshot) {
        // Use order's origin zone if not provided
        if (!resolvedOriginZoneId && order.shippingSnapshot.originId) {
          // Get origin and resolve zone from address
          const { SupplierOrigin } = await import('../models/SupplierOrigin');
          const { getShippingZone } = await import('../utils/shippingEngine');
          const origin = await SupplierOrigin.findById(order.shippingSnapshot.originId).lean();
          if (origin && origin.address) {
            const zone = await getShippingZone(storeId, {
              country: origin.address.country,
              state: origin.address.state,
              zip: origin.address.pincode,
            });
            if (zone) {
              resolvedOriginZoneId = zone._id;
            }
          }
        }
      }
    }
  }

  // Find matching mappings for returns
  const filter: any = {
    storeId: storeObjId,
    mappingType: 'returns',
    isActive: true,
  };

  // Filter by return reason
  if (returnReason) {
    filter.$or = [
      { returnReason: { $size: 0 } }, // No specific reasons
      { returnReason: returnReason },
    ];
  }

  // Filter by item condition
  if (itemCondition) {
    filter.$or = [
      ...(filter.$or || []),
      { itemCondition: null },
      { itemCondition: 'all' },
      { itemCondition },
    ];
  }

  // Filter by pickup support
  if (requiresPickup) {
    filter.$or = [
      ...(filter.$or || []),
      { supportsPickup: null },
      { supportsPickup: true },
    ];
  }

  const mappings = await CourierMapping.find(filter)
    .populate('courierId')
    .populate('fallbackCourierId')
    .sort({ priority: 1 })
    .lean();

  // Filter and score mappings
  const matchingMappings: Array<{ mapping: ICourierMapping; score: number }> = [];

  for (const mapping of mappings) {
    // Check return value
    if (mapping.returnValue !== null && mapping.returnValue !== undefined && returnValue !== undefined && returnValue < mapping.returnValue) {
      continue;
    }

    // Check conditions
    if (!checkConditions(mapping)) {
      continue;
    }

    // Get courier
    const courier = mapping.courierId as any as ICourier;
    if (!courier || !courier.isActive) {
      continue;
    }

    // Validate courier for returns
    const validation = validateCourierForReturns(courier, requiresPickup, resolvedOriginZoneId, customerZoneId);
    if (!validation.valid) {
      continue;
    }

    // Calculate score
    const score = calculateScore(courier, mapping, priority, 0, returnValue || 0);

    matchingMappings.push({ mapping, score });
  }

  if (matchingMappings.length === 0) {
    // Fallback: Find any courier that supports returns
    const fallbackCourier = await Courier.findOne({
      storeId: storeObjId,
      isActive: true,
    })
      .sort({ priority: 1 })
      .lean();

    if (!fallbackCourier) {
      throw new Error('No courier found for returns');
    }

    return {
      courier: fallbackCourier,
      mappingId: 'fallback',
      reason: 'Fallback courier for returns',
    };
  }

  // Sort by score
  matchingMappings.sort((a, b) => b.score - a.score);

  const selected = matchingMappings[0];
  const courier = selected.mapping.courierId as any as ICourier;
  const fallback = selected.mapping.fallbackCourierId as any as ICourier | undefined;

  return {
    courier,
    mappingId: selected.mapping._id,
    reason: `Returns mapping: ${selected.mapping.name} (priority: ${priority})`,
    score: selected.score,
    fallbackCourier: fallback && fallback.isActive ? fallback : undefined,
  };
}

/**
 * Map courier for CRM (customer service scenarios)
 */
export async function mapCourierForCRM(
  params: CRMMappingParams
): Promise<CourierMappingResult> {
  const {
    storeId,
    scenario,
    urgency,
    customerTier = 'standard',
    destinationZoneId,
    weight = 0,
    value = 0,
    priority = 'speed', // Default to speed for CRM
  } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // Find matching CRM mappings
  const filter: any = {
    storeId: storeObjId,
    mappingType: 'crm',
    isActive: true,
  };

  // Filter by scenario
  if (scenario) {
    filter.$or = [
      { crmScenario: null },
      { crmScenario: 'all' },
      { crmScenario: scenario },
    ];
  }

  // Filter by urgency
  if (urgency) {
    filter.$or = [
      ...(filter.$or || []),
      { urgency: null },
      { urgency },
    ];
  }

  // Filter by customer tier
  if (customerTier) {
    filter.$or = [
      ...(filter.$or || []),
      { customerTier: null },
      { customerTier: 'all' },
      { customerTier },
    ];
  }

  const mappings = await CourierMapping.find(filter)
    .populate('courierId')
    .populate('fallbackCourierId')
    .sort({ priority: 1 })
    .lean();

  // Filter and score mappings
  const matchingMappings: Array<{ mapping: ICourierMapping; score: number }> = [];

  for (const mapping of mappings) {
    // Check conditions
    if (!checkConditions(mapping)) {
      continue;
    }

    // Get courier
    const courier = mapping.courierId as any as ICourier;
    if (!courier || !courier.isActive) {
      continue;
    }

    // Validate courier for CRM
    const validation = validateCourierForCRM(courier, destinationZoneId, weight);
    if (!validation.valid) {
      continue;
    }

    // Calculate score (urgency affects score)
    const urgencyMultiplier = getUrgencyMultiplier(urgency);
    const score = calculateScore(courier, mapping, priority, weight, value) * urgencyMultiplier;

    matchingMappings.push({ mapping, score });
  }

  if (matchingMappings.length === 0) {
    // Fallback: Find any active courier
    const fallbackCourier = await Courier.findOne({
      storeId: storeObjId,
      isActive: true,
    })
      .sort({ priority: 1 })
      .lean();

    if (!fallbackCourier) {
      throw new Error('No courier found for CRM');
    }

    return {
      courier: fallbackCourier,
      mappingId: 'fallback',
      reason: 'Fallback courier for CRM',
    };
  }

  // Sort by score
  matchingMappings.sort((a, b) => b.score - a.score);

  const selected = matchingMappings[0];
  const courier = selected.mapping.courierId as any as ICourier;
  const fallback = selected.mapping.fallbackCourierId as any as ICourier | undefined;

  return {
    courier,
    mappingId: selected.mapping._id,
    reason: `CRM mapping: ${selected.mapping.name} (scenario: ${scenario}, urgency: ${urgency})`,
    score: selected.score,
    fallbackCourier: fallback && fallback.isActive ? fallback : undefined,
  };
}

/**
 * Validate courier for logistics
 */
function validateCourierForLogistics(
  courier: ICourier,
  paymentMethod: 'prepaid' | 'cod' | 'both',
  weight: number,
  zoneId: mongoose.Types.ObjectId,
  pincode?: string
): { valid: boolean; reason?: string } {
  if (!courier.isActive) {
    return { valid: false, reason: 'Courier is inactive' };
  }

  if (paymentMethod === 'cod' && !courier.supportsCOD) {
    return { valid: false, reason: 'Courier does not support COD' };
  }

  if (courier.maxWeight > 0 && weight > courier.maxWeight) {
    return { valid: false, reason: `Weight exceeds courier limit` };
  }

  const zoneObjId = typeof zoneId === 'string' ? new mongoose.Types.ObjectId(zoneId) : zoneId;
  if (!courier.serviceableZones.some((z) => z.toString() === zoneObjId.toString())) {
    return { valid: false, reason: 'Courier does not service this zone' };
  }

  if (pincode && courier.serviceablePincodes && courier.serviceablePincodes.length > 0) {
    if (!courier.serviceablePincodes.includes(pincode)) {
      return { valid: false, reason: 'Courier does not service this pincode' };
    }
  }

  return { valid: true };
}

/**
 * Validate courier for returns
 */
function validateCourierForReturns(
  courier: ICourier,
  requiresPickup: boolean,
  originZoneId?: mongoose.Types.ObjectId | string,
  customerZoneId?: mongoose.Types.ObjectId | string
): { valid: boolean; reason?: string } {
  if (!courier.isActive) {
    return { valid: false, reason: 'Courier is inactive' };
  }

  // Check if courier services origin zone (where items need to be returned)
  if (originZoneId) {
    const originZoneObjId = typeof originZoneId === 'string' ? new mongoose.Types.ObjectId(originZoneId) : originZoneId;
    if (!courier.serviceableZones.some((z) => z.toString() === originZoneObjId.toString())) {
      return { valid: false, reason: 'Courier does not service origin zone' };
    }
  }

  // For pickup, courier should service customer zone
  if (requiresPickup && customerZoneId) {
    const customerZoneObjId = typeof customerZoneId === 'string' ? new mongoose.Types.ObjectId(customerZoneId) : customerZoneId;
    if (!courier.serviceableZones.some((z) => z.toString() === customerZoneObjId.toString())) {
      return { valid: false, reason: 'Courier does not service customer zone for pickup' };
    }
  }

  return { valid: true };
}

/**
 * Validate courier for CRM
 */
function validateCourierForCRM(
  courier: ICourier,
  destinationZoneId?: mongoose.Types.ObjectId | string,
  weight?: number
): { valid: boolean; reason?: string } {
  if (!courier.isActive) {
    return { valid: false, reason: 'Courier is inactive' };
  }

  if (destinationZoneId) {
    const zoneObjId = typeof destinationZoneId === 'string' ? new mongoose.Types.ObjectId(destinationZoneId) : destinationZoneId;
    if (!courier.serviceableZones.some((z) => z.toString() === zoneObjId.toString())) {
      return { valid: false, reason: 'Courier does not service destination zone' };
    }
  }

  if (weight && courier.maxWeight > 0 && weight > courier.maxWeight) {
    return { valid: false, reason: 'Weight exceeds courier limit' };
  }

  return { valid: true };
}

/**
 * Check if mapping conditions are met
 */
function checkConditions(mapping: ICourierMapping): boolean {
  if (!mapping.conditions) {
    return true;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Check time of day
  if (mapping.conditions.timeOfDay && mapping.conditions.timeOfDay.length > 0) {
    const timeMatches = mapping.conditions.timeOfDay.some((timeRange) => {
      const [start, end] = timeRange.split('-').map((t) => parseInt(t.split(':')[0]));
      return currentHour >= start && currentHour < end;
    });
    if (!timeMatches) {
      return false;
    }
  }

  // Check day of week
  if (mapping.conditions.dayOfWeek && mapping.conditions.dayOfWeek.length > 0) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = dayNames[currentDay];
    if (!mapping.conditions.dayOfWeek.includes(currentDayName)) {
      return false;
    }
  }

  // Check season/special event (simplified - can be enhanced)
  if (mapping.conditions.specialEvent && !mapping.conditions.specialEvent) {
    // If special event is required but not active, skip
    // This can be enhanced with actual event checking
  }

  return true;
}

/**
 * Calculate courier score based on priority
 */
function calculateScore(
  courier: ICourier,
  mapping: ICourierMapping,
  priority: CourierMappingPriority,
  weight: number,
  value: number
): number {
  if (mapping.customScore !== null && mapping.customScore !== undefined) {
    return mapping.customScore;
  }

  let score = 1000; // Base score

  // Adjust based on courier priority (lower priority number = higher priority)
  score -= courier.priority * 10;

  // Adjust based on mapping priority
  score -= mapping.priority * 5;

  // Adjust based on selection priority
  switch (priority) {
    case 'cost':
      // Prefer lower cost (assume lower priority = lower cost)
      score += (1000 - courier.priority) * 2;
      break;
    case 'speed':
      // Prefer faster couriers (assume lower priority = faster)
      score += (1000 - courier.priority) * 3;
      break;
    case 'reliability':
      // Prefer reliable couriers (assume lower priority = more reliable)
      score += (1000 - courier.priority) * 2.5;
      break;
    case 'coverage':
      // Prefer couriers with better coverage
      score += courier.serviceableZones.length * 10;
      break;
  }

  return score;
}

/**
 * Get urgency multiplier for CRM scoring
 */
function getUrgencyMultiplier(urgency: 'low' | 'medium' | 'high' | 'critical'): number {
  switch (urgency) {
    case 'critical':
      return 3.0;
    case 'high':
      return 2.0;
    case 'medium':
      return 1.5;
    case 'low':
    default:
      return 1.0;
  }
}

/**
 * Get all available couriers for a scenario
 */
export async function getAvailableCouriersForScenario(
  storeId: mongoose.Types.ObjectId | string,
  mappingType: CourierMappingType,
  filters?: {
    zoneId?: mongoose.Types.ObjectId | string;
    paymentMethod?: 'prepaid' | 'cod';
    weight?: number;
    requiresPickup?: boolean;
  }
): Promise<ICourier[]> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const query: any = {
    storeId: storeObjId,
    isActive: true,
  };

  if (filters?.zoneId) {
    const zoneObjId = typeof filters.zoneId === 'string' ? new mongoose.Types.ObjectId(filters.zoneId) : filters.zoneId;
    query.serviceableZones = zoneObjId;
  }

  if (filters?.paymentMethod === 'cod') {
    query.supportsCOD = true;
  }

  const couriers = await Courier.find(query)
    .sort({ priority: 1 })
    .lean();

  // Filter by weight
  if (filters?.weight) {
    return couriers.filter((courier) => {
      if (courier.maxWeight > 0 && filters.weight! > courier.maxWeight) {
        return false;
      }
      return true;
    });
  }

  return couriers;
}

