import mongoose from 'mongoose';
import { SupplierOrigin } from '../models/SupplierOrigin';
import { OriginVariantInventory } from '../models/OriginVariantInventory';
import { ShippingZone } from '../models/ShippingZone';
import { Courier } from '../models/Courier';
import { FulfillmentRoute, IFulfillmentRoute, FulfillmentRouteType } from '../models/FulfillmentRoute';
import { calculateShipping } from '../utils/shippingEngine';
import { mapCourierForLogistics, mapCourierForReturns, mapCourierForCRM } from './courierMapping.service';
import { Order, IOrder } from '../models/Order';
import { RMA, IRMA } from '../models/RMA';

/**
 * Unified Fulfillment Routing Service
 * 
 * PURPOSE:
 * - Route fulfillment for Logistics (orders)
 * - Route fulfillment for Returns (RMAs)
 * - Route fulfillment for CRM (customer service)
 * - Support multi-origin routing
 * - Optimize for cost, speed, distance, or priority
 */

export interface FulfillmentItem {
  globalVariantId: mongoose.Types.ObjectId | string;
  quantity: number;
  supplierId?: mongoose.Types.ObjectId | string;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface RouteFulfillmentParams {
  routeType: FulfillmentRouteType;
  items: FulfillmentItem[];
  deliveryAddress: DeliveryAddress;
  storeId: mongoose.Types.ObjectId | string;
  // Reference IDs
  orderId?: mongoose.Types.ObjectId | string;
  rmaId?: mongoose.Types.ObjectId | string;
  crmTicketId?: string;
  // Routing options
  routingStrategy?: 'cost' | 'speed' | 'distance' | 'priority' | 'balanced';
  paymentMethod?: string;
  orderValue?: number;
  // For returns/CRM
  originZoneId?: mongoose.Types.ObjectId | string; // For returns: where items need to go
  urgency?: 'low' | 'medium' | 'high' | 'critical'; // For CRM
}

export interface RouteFulfillmentResult {
  success: boolean;
  route?: IFulfillmentRoute;
  error?: string;
}

/**
 * Calculate distance between two pincodes (simple estimation)
 */
function estimateDistance(pincode1: string, pincode2: string): number {
  if (pincode1 === pincode2) {
    return 0;
  }
  if (pincode1.substring(0, 3) === pincode2.substring(0, 3)) {
    return 10; // Same city
  }
  return 100; // Different regions
}

/**
 * Calculate Haversine distance between two lat/lng coordinates (in km)
 */
function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate routing score for an origin based on strategy
 */
async function calculateOriginScore(
  origin: any,
  deliveryAddress: DeliveryAddress,
  variantId: mongoose.Types.ObjectId | string,
  quantity: number,
  storeId: mongoose.Types.ObjectId,
  routingStrategy: 'cost' | 'speed' | 'distance' | 'priority' | 'balanced',
  paymentMethod?: string,
  orderValue?: number
): Promise<{ score: number; shippingCost?: number; courierId?: mongoose.Types.ObjectId; shippingZoneId?: mongoose.Types.ObjectId }> {
  let score = 0;
  let shippingCost = 0;
  let courierId: mongoose.Types.ObjectId | undefined;
  let shippingZoneId: mongoose.Types.ObjectId | undefined;

  // Get shipping zone for delivery address
  const { getShippingZone } = await import('../utils/shippingEngine');
  const zone = await getShippingZone(storeId, {
    country: deliveryAddress.country,
    state: deliveryAddress.state,
    zip: deliveryAddress.zip,
  });

  if (zone) {
    shippingZoneId = zone._id;

    // Calculate shipping cost
    try {
      const shippingResult = await calculateShipping({
        storeId,
        shippingAddress: deliveryAddress,
        orderWeight: quantity * 0.5, // Estimate 0.5kg per item
        orderValue: orderValue || 0,
        paymentMethod: (paymentMethod === 'cod' ? 'cod' : 'stripe') as 'stripe' | 'paypal' | 'cod' | 'cod_partial',
      });
      shippingCost = shippingResult.snapshot.totalShipping;
    } catch (error) {
      // If shipping calculation fails, use default
      shippingCost = 50; // Default shipping cost
    }
  }

  // Factor 1: Distance (40% weight for balanced, 100% for distance strategy)
  let distance = 0;
  if (origin.geo?.lat && origin.geo?.lng) {
    // TODO: Geocode delivery address for accurate distance
    // For now, use pincode-based estimation
    distance = estimateDistance(origin.address.pincode, deliveryAddress.zip);
  } else {
    distance = estimateDistance(origin.address.pincode, deliveryAddress.zip);
  }

  const distanceScore = distance * (routingStrategy === 'distance' ? 1.0 : 0.4);

  // Factor 2: Shipping Cost (30% weight for balanced, 100% for cost strategy)
  const costScore = shippingCost * (routingStrategy === 'cost' ? 1.0 : 0.3);

  // Factor 3: Origin Priority (20% weight for balanced, 100% for priority strategy)
  const priorityScore = (origin.priority || 999) * (routingStrategy === 'priority' ? 1.0 : 0.2);

  // Factor 4: Courier Availability (10% weight for balanced)
  const courierCount = origin.supportedCouriers?.length || 0;
  const courierScore = (100 - courierCount) * (routingStrategy === 'balanced' ? 0.1 : 0);

  // Calculate total score
  score = distanceScore + costScore + priorityScore + courierScore;

  // Map courier if needed
  if (zone && routingStrategy !== 'distance') {
    try {
      const courierMapping = await mapCourierForLogistics({
        storeId,
        shippingZoneId: zone._id,
        orderWeight: quantity * 0.5,
        orderValue: orderValue || 0,
        paymentMethod: paymentMethod === 'cod' || paymentMethod === 'cod_partial' ? 'cod' : 'prepaid',
        shippingPincode: deliveryAddress.zip,
        priority: routingStrategy === 'speed' ? 'speed' : 'cost',
      });
      courierId = courierMapping.courier._id;
    } catch (error) {
      // If courier mapping fails, continue without courier
    }
  }

  return { score, shippingCost, courierId, shippingZoneId };
}

/**
 * Route fulfillment for Logistics (orders)
 */
async function routeLogisticsFulfillment(
  params: RouteFulfillmentParams
): Promise<RouteFulfillmentResult> {
  const { items, deliveryAddress, storeId, orderId, routingStrategy = 'balanced', paymentMethod, orderValue } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const routedItems: IFulfillmentRoute['items'] = [];
  const shipmentGroupsMap = new Map<string, IFulfillmentRoute['shipmentGroups'][0]>();

  // Route each item
  for (const item of items) {
    const variantObjId = typeof item.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(item.globalVariantId)
      : item.globalVariantId;

    // Find origins with available stock
    const originQuery: any = {
      globalVariantId: variantObjId,
      availableStock: { $gte: item.quantity },
    };

    if (item.supplierId) {
      const supplierObjId = typeof item.supplierId === 'string'
        ? new mongoose.Types.ObjectId(item.supplierId)
        : item.supplierId;
      originQuery.supplierId = supplierObjId;
    }

    const originInventories = await OriginVariantInventory.find(originQuery)
      .populate({
        path: 'originId',
        match: { isActive: true },
      })
      .lean();

    const validOrigins = originInventories
      .map((inv) => {
        const origin = inv.originId as any;
        if (origin && origin.isActive && origin.storeId?.toString() === storeObjId.toString()) {
          return { inventory: inv, origin };
        }
        return null;
      })
      .filter((item) => item !== null) as Array<{ inventory: any; origin: any }>;

    if (validOrigins.length === 0) {
      return {
        success: false,
        error: `No active origin with sufficient stock for variant ${variantObjId} (required: ${item.quantity})`,
      };
    }

    // Calculate scores for each origin
    const originScores = await Promise.all(
      validOrigins.map(async ({ inventory, origin }) => {
        const scoreResult = await calculateOriginScore(
          origin,
          deliveryAddress,
          variantObjId,
          item.quantity,
          storeObjId,
          routingStrategy,
          paymentMethod,
          orderValue
        );

        return {
          origin,
          inventory,
          score: scoreResult.score,
          shippingCost: scoreResult.shippingCost || 0,
          courierId: scoreResult.courierId,
          shippingZoneId: scoreResult.shippingZoneId,
        };
      })
    );

    // Sort by score (lower is better)
    originScores.sort((a, b) => a.score - b.score);
    const bestOrigin = originScores[0];

    // Add to routed items
    routedItems.push({
      globalVariantId: variantObjId,
      quantity: item.quantity,
      supplierId: bestOrigin.origin.supplierId,
      originId: bestOrigin.origin._id,
      originName: bestOrigin.origin.name,
      routingScore: bestOrigin.score,
      shippingCost: bestOrigin.shippingCost,
      courierId: bestOrigin.courierId,
      shippingZoneId: bestOrigin.shippingZoneId,
    });

    // Add to shipment group
    const originIdStr = bestOrigin.origin._id.toString();
    if (!shipmentGroupsMap.has(originIdStr)) {
      shipmentGroupsMap.set(originIdStr, {
        originId: bestOrigin.origin._id,
        originName: bestOrigin.origin.name,
        items: [],
        shippingCost: bestOrigin.shippingCost || 0,
        courierId: bestOrigin.courierId,
        shippingZoneId: bestOrigin.shippingZoneId,
        status: 'pending',
      });
    }

    const group = shipmentGroupsMap.get(originIdStr)!;
    group.items.push({
      globalVariantId: variantObjId,
      quantity: item.quantity,
    });
  }

  // Calculate total shipping cost
  const totalShippingCost = Array.from(shipmentGroupsMap.values()).reduce(
    (total, group) => total + (group.shippingCost || 0),
    0
  );

  // Calculate overall routing score
  const routingScore = routedItems.reduce((total, item) => total + item.routingScore, 0) / routedItems.length;

  // Create fulfillment route
  const route = new FulfillmentRoute({
    storeId: storeObjId,
    routeType: 'logistics',
    orderId: orderId ? (typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId) : null,
    items: routedItems,
    shipmentGroups: Array.from(shipmentGroupsMap.values()),
    deliveryAddress,
    totalShippingCost,
    routingStrategy,
    routingScore,
    status: 'pending',
  });

  await route.save();

  return { success: true, route };
}

/**
 * Route fulfillment for Returns (RMAs)
 */
async function routeReturnsFulfillment(
  params: RouteFulfillmentParams
): Promise<RouteFulfillmentResult> {
  const { items, deliveryAddress, storeId, rmaId, originZoneId, routingStrategy = 'cost' } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // For returns, deliveryAddress is the origin/warehouse where items need to be returned
  // We need to find the best origin to receive the return
  // For now, use the originZoneId to find matching origins
  // In a real scenario, you'd route based on return processing capabilities

  // Find origins in the target zone
  const origins = await SupplierOrigin.find({
    storeId: storeObjId,
    isActive: true,
  })
    .populate('supplierId')
    .lean();

  // Filter origins by zone if provided
  let targetOrigins = origins;
  if (originZoneId) {
    // Get origins in the zone (simplified - would need zone mapping)
    targetOrigins = origins; // TODO: Filter by zone
  }

  if (targetOrigins.length === 0) {
    return {
      success: false,
      error: 'No active origins found for return processing',
    };
  }

  // For returns, typically route to a single origin (return processing center)
  // Select origin with highest priority (lowest priority number)
  targetOrigins.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  const selectedOrigin = targetOrigins[0];

  // Build routed items
  const routedItems: IFulfillmentRoute['items'] = items.map((item) => ({
    globalVariantId: typeof item.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(item.globalVariantId)
      : item.globalVariantId,
    quantity: item.quantity,
    supplierId: selectedOrigin.supplierId,
    originId: selectedOrigin._id,
    originName: selectedOrigin.name,
    routingScore: selectedOrigin.priority || 999,
  }));

  // Map courier for returns
  let courierId: mongoose.Types.ObjectId | undefined;
  try {
    const courierMapping = await mapCourierForReturns({
      storeId: storeObjId,
      rmaId: rmaId ? (typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId) : undefined,
      originZoneId,
      customerZoneId: originZoneId, // For returns, customer zone is where pickup happens
      requiresPickup: true,
      priority: 'cost',
    });
    courierId = courierMapping.courier._id;
  } catch (error) {
    // Continue without courier mapping
  }

  // Create shipment group
  const shipmentGroups: IFulfillmentRoute['shipmentGroups'] = [
    {
      originId: selectedOrigin._id,
      originName: selectedOrigin.name,
      items: items.map((item) => ({
        globalVariantId: typeof item.globalVariantId === 'string'
          ? new mongoose.Types.ObjectId(item.globalVariantId)
          : item.globalVariantId,
        quantity: item.quantity,
      })),
      shippingCost: 0, // Return shipping cost calculated separately
      courierId,
      status: 'pending',
    },
  ];

  // Create fulfillment route
  const route = new FulfillmentRoute({
    storeId: storeObjId,
    routeType: 'returns',
    rmaId: rmaId ? (typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId) : null,
    items: routedItems,
    shipmentGroups,
    deliveryAddress,
    totalShippingCost: 0,
    routingStrategy,
    routingScore: selectedOrigin.priority || 999,
    status: 'pending',
  });

  await route.save();

  return { success: true, route };
}

/**
 * Route fulfillment for CRM
 */
async function routeCRMFulfillment(
  params: RouteFulfillmentParams
): Promise<RouteFulfillmentResult> {
  const { items, deliveryAddress, storeId, crmTicketId, urgency = 'medium', routingStrategy = 'speed' } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // For CRM, typically route to a single origin (service center or main warehouse)
  // Select based on urgency and routing strategy

  const origins = await SupplierOrigin.find({
    storeId: storeObjId,
    isActive: true,
  })
    .lean();

  if (origins.length === 0) {
    return {
      success: false,
      error: 'No active origins found for CRM fulfillment',
    };
  }

  // For high urgency, prefer origins with better courier support
  // For normal urgency, use standard routing
  let selectedOrigin = origins[0];
  if (urgency === 'high' || urgency === 'critical') {
    // Select origin with most courier support
    origins.sort((a, b) => (b.supportedCouriers?.length || 0) - (a.supportedCouriers?.length || 0));
    selectedOrigin = origins[0];
  } else {
    // Select by priority
    origins.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    selectedOrigin = origins[0];
  }

  // Build routed items
  const routedItems: IFulfillmentRoute['items'] = items.map((item) => ({
    globalVariantId: typeof item.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(item.globalVariantId)
      : item.globalVariantId,
    quantity: item.quantity,
    supplierId: selectedOrigin.supplierId,
    originId: selectedOrigin._id,
    originName: selectedOrigin.name,
    routingScore: urgency === 'high' || urgency === 'critical' ? 1 : (selectedOrigin.priority || 999),
  }));

  // Map courier for CRM
  let courierId: mongoose.Types.ObjectId | undefined;
  try {
    const courierMapping = await mapCourierForCRM({
      storeId: storeObjId,
      scenario: 'replacement', // Default scenario
      urgency,
      destinationZoneId: undefined, // Would come from ticket data
      priority: routingStrategy === 'speed' ? 'speed' : 'cost',
    });
    courierId = courierMapping.courier._id;
  } catch (error) {
    // Continue without courier mapping
  }

  // Create shipment group
  const shipmentGroups: IFulfillmentRoute['shipmentGroups'] = [
    {
      originId: selectedOrigin._id,
      originName: selectedOrigin.name,
      items: items.map((item) => ({
        globalVariantId: typeof item.globalVariantId === 'string'
          ? new mongoose.Types.ObjectId(item.globalVariantId)
          : item.globalVariantId,
        quantity: item.quantity,
      })),
      shippingCost: 0,
      courierId,
      status: 'pending',
    },
  ];

  // Create fulfillment route
  const route = new FulfillmentRoute({
    storeId: storeObjId,
    routeType: 'crm',
    crmTicketId: crmTicketId || null,
    items: routedItems,
    shipmentGroups,
    deliveryAddress,
    totalShippingCost: 0,
    routingStrategy,
    routingScore: urgency === 'high' || urgency === 'critical' ? 1 : (selectedOrigin.priority || 999),
    status: 'pending',
  });

  await route.save();

  return { success: true, route };
}

/**
 * Main routing function
 */
export async function routeFulfillment(
  params: RouteFulfillmentParams
): Promise<RouteFulfillmentResult> {
  const { routeType } = params;

  try {
    switch (routeType) {
      case 'logistics':
        return await routeLogisticsFulfillment(params);
      case 'returns':
        return await routeReturnsFulfillment(params);
      case 'crm':
        return await routeCRMFulfillment(params);
      default:
        return { success: false, error: `Invalid route type: ${routeType}` };
    }
  } catch (error: any) {
    console.error('[FULFILLMENT ROUTING] Error:', error);
    return {
      success: false,
      error: error.message || 'Fulfillment routing failed',
    };
  }
}

/**
 * Get fulfillment route by reference
 */
export async function getFulfillmentRoute(
  routeType: FulfillmentRouteType,
  referenceId: mongoose.Types.ObjectId | string,
  storeId?: mongoose.Types.ObjectId | string
): Promise<IFulfillmentRoute | null> {
  const refObjId = typeof referenceId === 'string' ? new mongoose.Types.ObjectId(referenceId) : referenceId;

  const filter: any = {
    routeType,
  };

  switch (routeType) {
    case 'logistics':
      filter.orderId = refObjId;
      break;
    case 'returns':
      filter.rmaId = refObjId;
      break;
    case 'crm':
      filter.crmTicketId = referenceId.toString();
      break;
  }

  if (storeId) {
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    filter.storeId = storeObjId;
  }

  return await FulfillmentRoute.findOne(filter).lean();
}

/**
 * Confirm fulfillment route
 */
export async function confirmFulfillmentRoute(
  routeId: mongoose.Types.ObjectId | string,
  storeId: mongoose.Types.ObjectId | string
): Promise<{ success: boolean; route?: IFulfillmentRoute; error?: string }> {
  const routeObjId = typeof routeId === 'string' ? new mongoose.Types.ObjectId(routeId) : routeId;
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const route = await FulfillmentRoute.findOne({
    _id: routeObjId,
    storeId: storeObjId,
    status: 'pending',
  });

  if (!route) {
    return { success: false, error: 'Route not found or already confirmed' };
  }

  route.status = 'confirmed';
  route.confirmedAt = new Date();
  await route.save();

  return { success: true, route };
}

