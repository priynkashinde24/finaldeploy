import mongoose from 'mongoose';
import { SupplierOrigin } from '../models/SupplierOrigin';
import { OriginVariantInventory } from '../models/OriginVariantInventory';
import { calculateShipping, ShippingSnapshot } from './shippingEngine';
import { assignCourier, AssignCourierResult } from './courierEngine';
import { ShippingZone } from '../models/ShippingZone';
import { logAudit } from '../utils/auditLogger';
import { Request } from 'express';

/**
 * Fulfillment Routing Engine
 * 
 * PURPOSE:
 * - Route each order item to the best supplier origin
 * - Support multiple warehouses per supplier
 * - Optimize for availability, distance, SLA, and cost
 * - Allow split shipments (multi-origin)
 * - Freeze routing decision at order creation
 * 
 * RULES:
 * - Only route to active origins
 * - Only route if stock available
 * - Never oversell origin inventory
 * - Routing decision immutable
 */

export interface CartItem {
  globalVariantId: mongoose.Types.ObjectId | string;
  quantity: number;
  supplierId?: mongoose.Types.ObjectId | string; // Optional: if already known
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface FulfillmentRouteItem {
  globalVariantId: mongoose.Types.ObjectId | string;
  quantity: number;
  supplierId: mongoose.Types.ObjectId | string;
  originId: mongoose.Types.ObjectId | string;
  originAddress: {
    name: string;
    country: string;
    state: string;
    city: string;
    pincode: string;
    street?: string;
  };
  courierId?: mongoose.Types.ObjectId | string;
  shippingZoneId?: mongoose.Types.ObjectId | string;
  shippingCost?: number;
  score?: number; // Routing score (for debugging)
}

export interface FulfillmentRouteResult {
  success: boolean;
  items?: FulfillmentRouteItem[];
  shipmentGroups?: Array<{
    originId: mongoose.Types.ObjectId | string;
    items: Array<{
      globalVariantId: mongoose.Types.ObjectId | string;
      quantity: number;
    }>;
    shippingCost: number;
    courierId?: mongoose.Types.ObjectId | string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered';
  }>;
  error?: string;
}

export interface RouteFulfillmentParams {
  cartItems: CartItem[];
  deliveryAddress: DeliveryAddress;
  storeId: mongoose.Types.ObjectId | string;
  paymentMethod?: string;
  orderValue?: number;
  req?: Request; // For audit logging
}

/**
 * Calculate distance between two pincodes (simple estimation)
 * Uses approximate distance based on pincode regions
 * For production, use geocoding API or pincode distance database
 */
function estimateDistance(pincode1: string, pincode2: string): number {
  // Simple estimation: if same pincode = 0, same city = 10km, different = 100km+
  // This is a placeholder - in production, use proper distance calculation
  if (pincode1 === pincode2) {
    return 0;
  }
  
  // Same first 3 digits = same city/region
  if (pincode1.substring(0, 3) === pincode2.substring(0, 3)) {
    return 10; // ~10km
  }
  
  // Different regions
  return 100; // ~100km+
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
 * Calculate routing score for an origin
 * Lower score = better (preferred)
 */
async function calculateOriginScore(
  origin: any,
  deliveryAddress: DeliveryAddress,
  variantId: mongoose.Types.ObjectId | string,
  quantity: number,
  storeId: mongoose.Types.ObjectId,
  paymentMethod?: string
): Promise<{ score: number; shippingCost?: number; courierId?: mongoose.Types.ObjectId }> {
  let score = 0;

  // Factor 1: Distance (40% weight)
  let distance = 0;
  if (origin.geo?.lat && origin.geo?.lng) {
    // TODO: Get delivery address coordinates via geocoding API
    // For now, use pincode-based estimation as fallback
    // In production, geocode deliveryAddress.zip to get lat/lng
    distance = estimateDistance(origin.address.pincode, deliveryAddress.zip);
    
    // If we had delivery coordinates, we'd use:
    // distance = calculateHaversineDistance(
    //   origin.geo.lat,
    //   origin.geo.lng,
    //   deliveryLat,
    //   deliveryLng
    // );
  } else {
    distance = estimateDistance(origin.address.pincode, deliveryAddress.zip);
  }
  score += distance * 0.4;

  // Factor 2: Shipping cost (30% weight)
  // Calculate shipping FROM origin TO delivery address
  let shippingCost = 0;
  try {
    // Get shipping zone for delivery address (not origin)
    const deliveryZone = await ShippingZone.findOne({
      storeId,
      countryCode: deliveryAddress.country.toUpperCase(),
      $or: [
        { pincodes: { $in: [deliveryAddress.zip] } },
        { stateCodes: { $in: [deliveryAddress.state] } },
      ],
      isActive: true,
    }).lean();

    if (deliveryZone) {
      const shippingResult = await calculateShipping({
        storeId,
        shippingAddress: deliveryAddress, // FROM origin TO delivery address
        orderWeight: quantity * 0.5, // Default 0.5 kg per item
        orderValue: 0, // Will be calculated per item
        paymentMethod: (paymentMethod as 'stripe' | 'paypal' | 'cod' | 'cod_partial') || 'stripe',
      });

      shippingCost = shippingResult.snapshot.totalShipping;
      score += shippingCost * 0.3;
    } else {
      // If no zone found, penalize this origin
      score += 1000;
    }
  } catch (error) {
    // If shipping calculation fails, penalize this origin
    score += 1000;
  }

  // Factor 3: Origin priority (20% weight)
  // Lower priority number = higher priority
  score += (origin.priority || 999) * 0.2;

  // Factor 4: Courier availability (10% weight)
  // Prefer origins with more courier options
  const courierCount = origin.supportedCouriers?.length || 0;
  score -= courierCount * 0.1; // More couriers = lower score (better)

  // Try to assign courier
  let courierId: mongoose.Types.ObjectId | undefined;
  try {
    const zone = await ShippingZone.findOne({
      storeId,
      countryCode: deliveryAddress.country,
      $or: [
        { pincodes: { $in: [deliveryAddress.zip] } },
        { stateCodes: { $in: [deliveryAddress.state] } },
      ],
      isActive: true,
    }).lean();

    if (zone) {
      const courierResult = await assignCourier({
        storeId,
        shippingZoneId: zone._id,
        orderWeight: quantity * 0.5,
        orderValue: 0,
        paymentMethod: (paymentMethod as 'stripe' | 'paypal' | 'cod' | 'cod_partial') || 'stripe',
        shippingPincode: deliveryAddress.zip,
      });

      if (courierResult && courierResult.snapshot) {
        courierId = typeof courierResult.snapshot.courierId === 'string'
          ? new mongoose.Types.ObjectId(courierResult.snapshot.courierId)
          : courierResult.snapshot.courierId;
      }
    }
  } catch (error) {
    // Courier assignment failed, but don't block routing
  }

  return { score, shippingCost, courierId };
}

/**
 * Route fulfillment for cart items
 */
export async function routeFulfillment(
  params: RouteFulfillmentParams
): Promise<FulfillmentRouteResult> {
  const { cartItems, deliveryAddress, storeId, paymentMethod, orderValue, req } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const routedItems: FulfillmentRouteItem[] = [];
  const errors: string[] = [];

  // Route each item
  for (const item of cartItems) {
    const variantObjId =
      typeof item.globalVariantId === 'string'
        ? new mongoose.Types.ObjectId(item.globalVariantId)
        : item.globalVariantId;

    // Step 1: Find all origins with available stock
    // Filter by supplier if known (optimization)
    const originQuery: any = {
      globalVariantId: variantObjId,
      availableStock: { $gte: item.quantity },
    };

    // If supplierId is known, filter by supplier (optimization)
    if (item.supplierId) {
      const supplierObjId = typeof item.supplierId === 'string'
        ? new mongoose.Types.ObjectId(item.supplierId)
        : item.supplierId;
      originQuery.supplierId = supplierObjId;
    }

    const originInventories = await OriginVariantInventory.find(originQuery)
      .populate({
        path: 'originId',
        match: { isActive: true }, // Only populate active origins
      })
      .lean();

    // Filter to active origins only (and ensure origin was populated)
    const validOrigins = originInventories
      .map((inv) => {
        const origin = inv.originId as any;
        // Check if origin exists and is active (populate match already filters, but double-check)
        if (origin && origin.isActive && origin.storeId?.toString() === storeObjId.toString()) {
          return { inventory: inv, origin };
        }
        return null;
      })
      .filter((item) => item !== null) as Array<{ inventory: any; origin: any }>;

    if (validOrigins.length === 0) {
      errors.push(
        `No active origin with sufficient stock for variant ${variantObjId} (required: ${item.quantity})`
      );
      continue;
    }

    // Step 2: Calculate score for each origin
    const originScores = await Promise.all(
      validOrigins.map(async ({ inventory, origin }) => {
        const scoreResult = await calculateOriginScore(
          origin,
          deliveryAddress,
          variantObjId,
          item.quantity,
          storeObjId,
          paymentMethod
        );

        return {
          origin,
          inventory,
          score: scoreResult.score,
          shippingCost: scoreResult.shippingCost,
          courierId: scoreResult.courierId,
        };
      })
    );

    // Step 3: Pick best origin (lowest score)
    originScores.sort((a, b) => a.score - b.score);
    const bestOrigin = originScores[0];

    // Step 4: Get shipping zone for delivery address
    const zone = await ShippingZone.findOne({
      storeId: storeObjId,
      countryCode: deliveryAddress.country.toUpperCase(),
      $or: [
        { pincodes: { $in: [deliveryAddress.zip] } },
        { stateCodes: { $in: [deliveryAddress.state] } },
      ],
      isActive: true,
    }).lean();

    // Step 5: Build routed item
    const supplierId = bestOrigin.origin.supplierId;
    const originId = bestOrigin.origin._id;

    routedItems.push({
      globalVariantId: variantObjId,
      quantity: item.quantity,
      supplierId,
      originId,
      originAddress: {
        name: bestOrigin.origin.name,
        country: bestOrigin.origin.address.country,
        state: bestOrigin.origin.address.state,
        city: bestOrigin.origin.address.city,
        pincode: bestOrigin.origin.address.pincode,
        street: bestOrigin.origin.address.street,
      },
      courierId: bestOrigin.courierId,
      shippingZoneId: zone?._id,
      shippingCost: bestOrigin.shippingCost || 0,
      score: bestOrigin.score,
    });

    // Audit log
    if (req) {
      await logAudit({
        req,
        action: 'ORIGIN_SELECTED',
        entityType: 'Order',
        description: `Origin selected for variant ${variantObjId}: ${bestOrigin.origin.name}`,
        metadata: {
          variantId: variantObjId.toString(),
          originId: originId.toString(),
          supplierId: supplierId.toString(),
          quantity: item.quantity,
          score: bestOrigin.score,
          shippingCost: bestOrigin.shippingCost,
        },
      });
    }
  }

  // If any items couldn't be routed, fail
  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join('; '),
    };
  }

  // Step 6: Group items by origin (for shipment groups)
  const shipmentGroupsMap = new Map<string, typeof routedItems>();
  routedItems.forEach((item) => {
    const originKey = item.originId.toString();
    if (!shipmentGroupsMap.has(originKey)) {
      shipmentGroupsMap.set(originKey, []);
    }
    shipmentGroupsMap.get(originKey)!.push(item);
  });

  const shipmentGroups = Array.from(shipmentGroupsMap.entries()).map(([originId, items]) => {
    const totalShipping = items.reduce((sum, item) => sum + (item.shippingCost || 0), 0);
    const courierId = items[0]?.courierId; // Use first item's courier (can be enhanced)

    return {
      originId,
      items: items.map((item) => ({
        globalVariantId: item.globalVariantId,
        quantity: item.quantity,
      })),
      shippingCost: totalShipping,
      courierId,
      status: 'pending' as const,
    };
  });

  // Audit log
  if (req) {
    await logAudit({
      req,
      action: 'FULFILLMENT_ROUTED',
      entityType: 'Order',
      description: `Fulfillment routed: ${routedItems.length} items, ${shipmentGroups.length} shipments`,
      metadata: {
        itemCount: routedItems.length,
        shipmentCount: shipmentGroups.length,
        origins: shipmentGroups.map((g) => g.originId.toString()),
      },
    });
  }

  return {
    success: true,
    items: routedItems,
    shipmentGroups,
  };
}

