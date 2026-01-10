import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { RMA, IRMA, IRMAItem, RMAType } from '../models/RMA';
import { Order, IOrder } from '../models/Order';
import { generateRMANumber } from '../utils/rmaNumber';
import { validateReturn, ReturnItemRequest } from '../utils/returnPolicy';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';
import { Request } from 'express';
import { ProductVariant } from '../models/ProductVariant';

/**
 * Unified RMA Return Request Service
 * 
 * PURPOSE:
 * - Create RMA requests for Logistics (orders)
 * - Create RMA requests for Returns (re-returns, exchanges)
 * - Create RMA requests for CRM (warranty, replacements, etc.)
 * - Unified API for all RMA request scenarios
 */

export interface CreateRMARequestParams {
  rmaType: RMAType;
  // Reference IDs (one per type)
  orderId?: string;
  rmaId?: mongoose.Types.ObjectId | string;
  crmTicketId?: string;
  // Common fields
  items: ReturnItemRequest[];
  refundMethod: 'original' | 'wallet' | 'cod_adjustment';
  storeId: mongoose.Types.ObjectId | string;
  customerId?: mongoose.Types.ObjectId | string;
  // CRM-specific
  crmScenario?: 'warranty' | 'replacement' | 'defective' | 'wrong_item' | 'other';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  // Returns-specific
  exchangeRequested?: boolean;
  exchangeVariantId?: mongoose.Types.ObjectId | string;
  req?: Request;
}

export interface CreateRMARequestResult {
  success: boolean;
  rma?: IRMA;
  error?: string;
}

/**
 * Create RMA request for Logistics (order returns)
 */
async function createLogisticsRMARequest(
  params: CreateRMARequestParams,
  session: ClientSession
): Promise<CreateRMARequestResult> {
  const { orderId, items, refundMethod, storeId, customerId, req } = params;

  if (!orderId) {
    return { success: false, error: 'Order ID is required for logistics RMA' };
  }

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // Fetch order
  const order = await Order.findOne({ orderId, storeId: storeObjId }).session(session);
  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  // Validate customer ownership
  if (customerId) {
    const customerObjId = typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId;
    if (order.customerId?.toString() !== customerObjId.toString()) {
      return { success: false, error: 'Order does not belong to this customer' };
    }
  }

  // Validate return eligibility
  const validation = await validateReturn(order, items, storeObjId);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  // Map items to RMA items
  const rmaItems: IRMAItem[] = [];
  const fulfillmentItems = order.fulfillmentSnapshot?.items || [];

  for (const returnItem of items) {
    const variantId = typeof returnItem.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(returnItem.globalVariantId)
      : returnItem.globalVariantId;

    // Find fulfillment info
    const fulfillmentItem = fulfillmentItems.find(
      (item) => item.globalVariantId.toString() === variantId.toString()
    );

    if (!fulfillmentItem) {
      return { success: false, error: `Fulfillment information not found for item ${variantId}` };
    }

    // Find order item for price
    const orderItem = order.items.find(
      (item) => item.globalVariantId?.toString() === variantId.toString()
    );

    rmaItems.push({
      globalVariantId: variantId,
      quantity: returnItem.quantity,
      originId: fulfillmentItem.originId,
      shipmentId: undefined,
      reason: returnItem.reason,
      condition: returnItem.condition,
      originalPrice: orderItem?.unitPrice || orderItem?.totalPrice || 0,
      refundAmount: 0, // Will be calculated later
    });
  }

  // Calculate refund amount
  const refundAmount = await calculateRefundAmount(order, rmaItems);

  // Generate RMA number
  const rmaNumber = await generateRMANumber(storeObjId, 'logistics', session);

  // Create RMA
  const rma = new RMA({
    storeId: storeObjId,
    rmaType: 'logistics',
    orderId: order._id,
    rmaNumber,
    customerId: customerId
      ? (typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId)
      : order.customerId,
    items: rmaItems,
    status: 'requested',
    refundMethod,
    refundAmount,
    refundStatus: 'pending',
  });

  await rma.save({ session });

  // Emit event
  eventStreamEmitter.emit('event', {
    eventType: 'RMA_REQUESTED',
    payload: {
      rmaType: 'logistics',
      rmaNumber,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
    },
    storeId: storeObjId.toString(),
    userId: customerId?.toString() || order.customerId?.toString() || '',
    occurredAt: new Date(),
  });

  // Audit log
  if (req) {
    await logAudit({
      req,
      action: 'RMA_REQUESTED',
      entityType: 'RMA',
      entityId: rma._id.toString(),
      description: `RMA request created: ${rmaNumber} for order ${order.orderNumber}`,
      after: {
        rmaType: 'logistics',
        rmaNumber,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        status: 'requested',
      },
    });
  }

  return { success: true, rma };
}

/**
 * Create RMA request for Returns (re-returns or exchanges)
 */
async function createReturnsRMARequest(
  params: CreateRMARequestParams,
  session: ClientSession
): Promise<CreateRMARequestResult> {
  const { rmaId, items, refundMethod, storeId, customerId, exchangeRequested, exchangeVariantId, req } = params;

  if (!rmaId) {
    return { success: false, error: 'RMA ID is required for returns RMA' };
  }

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const originalRmaObjId = typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId;

  // Fetch original RMA
  const originalRma = await RMA.findById(originalRmaObjId).populate('orderId').session(session);
  if (!originalRma) {
    return { success: false, error: 'Original RMA not found' };
  }

  // Validate original RMA is completed/closed
  if (!['received', 'refunded', 'closed'].includes(originalRma.status)) {
    return { success: false, error: 'Original RMA must be completed before creating a return RMA' };
  }

  // Validate customer ownership
  if (customerId) {
    const customerObjId = typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId;
    if (originalRma.customerId?.toString() !== customerObjId.toString()) {
      return { success: false, error: 'RMA does not belong to this customer' };
    }
  }

  const order = originalRma.orderId as any as IOrder;

  // Map items to RMA items (using original order fulfillment info)
  const rmaItems: IRMAItem[] = [];
  const fulfillmentItems = order?.fulfillmentSnapshot?.items || [];

  for (const returnItem of items) {
    const variantId = typeof returnItem.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(returnItem.globalVariantId)
      : returnItem.globalVariantId;

    // Find fulfillment info
    const fulfillmentItem = fulfillmentItems.find(
      (item) => item.globalVariantId.toString() === variantId.toString()
    );

    if (!fulfillmentItem) {
      return { success: false, error: `Fulfillment information not found for item ${variantId}` };
    }

    // Find order item for price
    const orderItem = order?.items.find(
      (item) => item.globalVariantId?.toString() === variantId.toString()
    );

    rmaItems.push({
      globalVariantId: variantId,
      quantity: returnItem.quantity,
      originId: fulfillmentItem.originId,
      shipmentId: undefined,
      reason: returnItem.reason,
      condition: returnItem.condition,
      originalPrice: orderItem?.unitPrice || orderItem?.totalPrice || 0,
      refundAmount: 0,
    });
  }

  // Calculate refund amount
  const refundAmount = order ? await calculateRefundAmount(order, rmaItems) : 0;

  // Generate RMA number
  const rmaNumber = await generateRMANumber(storeObjId, 'returns', session);

  // Create RMA
  const rma = new RMA({
    storeId: storeObjId,
    rmaType: 'returns',
    rmaId: originalRmaObjId,
    originalRmaId: originalRmaObjId,
    rmaNumber,
    customerId: customerId
      ? (typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId)
      : originalRma.customerId,
    items: rmaItems,
    status: 'requested',
    refundMethod,
    refundAmount,
    refundStatus: 'pending',
    exchangeRequested: exchangeRequested || false,
    exchangeVariantId: exchangeVariantId
      ? (typeof exchangeVariantId === 'string' ? new mongoose.Types.ObjectId(exchangeVariantId) : exchangeVariantId)
      : null,
  });

  await rma.save({ session });

  // Emit event
  eventStreamEmitter.emit('event', {
    eventType: 'RMA_REQUESTED',
    payload: {
      rmaType: 'returns',
      rmaNumber,
      originalRmaNumber: originalRma.rmaNumber,
      exchangeRequested: exchangeRequested || false,
    },
    storeId: storeObjId.toString(),
    userId: customerId?.toString() || originalRma.customerId?.toString() || '',
    occurredAt: new Date(),
  });

  // Audit log
  if (req) {
    await logAudit({
      req,
      action: 'RMA_REQUESTED',
      entityType: 'RMA',
      entityId: rma._id.toString(),
      description: `Return RMA request created: ${rmaNumber} for original RMA ${originalRma.rmaNumber}`,
      after: {
        rmaType: 'returns',
        rmaNumber,
        originalRmaNumber: originalRma.rmaNumber,
        exchangeRequested: exchangeRequested || false,
        status: 'requested',
      },
    });
  }

  return { success: true, rma };
}

/**
 * Create RMA request for CRM (warranty, replacements, etc.)
 */
async function createCRMRMARequest(
  params: CreateRMARequestParams,
  session: ClientSession
): Promise<CreateRMARequestResult> {
  const { crmTicketId, items, refundMethod, storeId, customerId, crmScenario, urgency, req } = params;

  if (!crmTicketId) {
    return { success: false, error: 'CRM ticket ID is required for CRM RMA' };
  }

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // For CRM, we may not have an order - items are for warranty/replacement
  // Build RMA items
  const rmaItems: IRMAItem[] = [];

  for (const returnItem of items) {
    const variantId = typeof returnItem.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(returnItem.globalVariantId)
      : returnItem.globalVariantId;

    // Get variant for price
    const variant = await ProductVariant.findById(variantId).session(session);
    if (!variant) {
      return { success: false, error: `Variant not found: ${variantId}` };
    }

    // For CRM, origin might not be known - use default or find from variant
    // This is simplified - in production, you'd have better origin resolution
    const defaultOriginId = new mongoose.Types.ObjectId(); // Placeholder

    rmaItems.push({
      globalVariantId: variantId,
      quantity: returnItem.quantity,
      originId: defaultOriginId, // Would be resolved from CRM ticket or variant
      shipmentId: undefined,
      reason: returnItem.reason,
      condition: returnItem.condition,
      originalPrice: variant.basePrice || 0,
      refundAmount: 0,
    });
  }

  // Calculate refund amount (for CRM, might be warranty replacement, so refund might be 0)
  const refundAmount = crmScenario === 'warranty' || crmScenario === 'replacement' ? 0 : 
    rmaItems.reduce((total, item) => total + (item.originalPrice * item.quantity), 0);

  // Generate RMA number
  const rmaNumber = await generateRMANumber(storeObjId, 'crm', session);

  // Create RMA
  const rma = new RMA({
    storeId: storeObjId,
    rmaType: 'crm',
    crmTicketId,
    rmaNumber,
    customerId: customerId
      ? (typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId)
      : null,
    items: rmaItems,
    status: 'requested',
    refundMethod,
    refundAmount,
    refundStatus: 'pending',
    crmScenario: crmScenario || 'other',
    urgency: urgency || 'medium',
  });

  await rma.save({ session });

  // Emit event
  eventStreamEmitter.emit('event', {
    eventType: 'RMA_REQUESTED',
    payload: {
      rmaType: 'crm',
      rmaNumber,
      crmTicketId,
      scenario: crmScenario,
      urgency: urgency,
    },
    storeId: storeObjId.toString(),
    userId: customerId?.toString() || '',
    occurredAt: new Date(),
  });

  // Audit log
  if (req) {
    await logAudit({
      req,
      action: 'RMA_REQUESTED',
      entityType: 'RMA',
      entityId: rma._id.toString(),
      description: `CRM RMA request created: ${rmaNumber} for ticket ${crmTicketId}`,
      after: {
        rmaType: 'crm',
        rmaNumber,
        crmTicketId,
        scenario: crmScenario,
        urgency: urgency,
        status: 'requested',
      },
    });
  }

  return { success: true, rma };
}

/**
 * Calculate refund amount for RMA items
 */
async function calculateRefundAmount(
  order: IOrder,
  rmaItems: IRMAItem[]
): Promise<number> {
  let totalRefund = 0;

  const orderItemsMap = new Map(
    order.items
      .filter((item) => item.globalVariantId)
      .map((item) => [item.globalVariantId!.toString(), item])
  );

  for (const rmaItem of rmaItems) {
    const variantId = typeof rmaItem.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(rmaItem.globalVariantId)
      : rmaItem.globalVariantId;

    const orderItem = orderItemsMap.get(variantId.toString());
    if (!orderItem) {
      continue;
    }

    const itemPrice = orderItem.unitPrice || orderItem.totalPrice || 0;
    const returnRatio = rmaItem.quantity / orderItem.quantity;
    const itemRefund = itemPrice * returnRatio;

    // Adjust for return shipping if customer pays
    if (rmaItem.returnShipping && rmaItem.returnShipping.payer === 'customer') {
      const adjustedRefund = itemRefund - rmaItem.returnShipping.amount;
      totalRefund += Math.max(0, adjustedRefund);
    } else {
      totalRefund += itemRefund;
    }

    rmaItem.refundAmount = itemRefund;
  }

  return totalRefund;
}

/**
 * Main function to create RMA request
 */
export async function createRMARequest(
  params: CreateRMARequestParams
): Promise<CreateRMARequestResult> {
  const { rmaType } = params;

  try {
    return await withTransaction(async (session: ClientSession) => {
      switch (rmaType) {
        case 'logistics':
          return await createLogisticsRMARequest(params, session);
        case 'returns':
          return await createReturnsRMARequest(params, session);
        case 'crm':
          return await createCRMRMARequest(params, session);
        default:
          return { success: false, error: `Invalid RMA type: ${rmaType}` };
      }
    });
  } catch (error: any) {
    console.error('[RMA REQUEST] Error:', error);
    return {
      success: false,
      error: error.message || 'RMA request creation failed',
    };
  }
}

/**
 * Get RMA request by reference
 */
export async function getRMARequest(
  rmaType: RMAType,
  referenceId: mongoose.Types.ObjectId | string,
  storeId?: mongoose.Types.ObjectId | string
): Promise<IRMA | null> {
  const refObjId = typeof referenceId === 'string' ? new mongoose.Types.ObjectId(referenceId) : referenceId;

  const filter: any = {
    rmaType,
  };

  switch (rmaType) {
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

  return await RMA.findOne(filter).sort({ createdAt: -1 }).lean();
}

/**
 * List RMA requests with filters
 */
export async function listRMARequests(params: {
  storeId: mongoose.Types.ObjectId | string;
  rmaType?: RMAType;
  status?: string;
  customerId?: mongoose.Types.ObjectId | string;
  page?: number;
  limit?: number;
}): Promise<{ rmas: IRMA[]; total: number; page: number; limit: number }> {
  const { storeId, rmaType, status, customerId, page = 1, limit = 50 } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const filter: any = { storeId: storeObjId };

  if (rmaType) {
    filter.rmaType = rmaType;
  }

  if (status) {
    filter.status = status;
  }

  if (customerId) {
    const customerObjId = typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId;
    filter.customerId = customerObjId;
  }

  const skip = (page - 1) * limit;

  const [rmas, total] = await Promise.all([
    RMA.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RMA.countDocuments(filter),
  ]);

  return { rmas, total, page, limit };
}

