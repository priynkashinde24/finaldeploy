import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { RMA, IRMA } from '../models/RMA';
import { ShippingLabel } from '../models/ShippingLabel';
import { Courier } from '../models/Courier';
import { OrderStatusHistory } from '../models/OrderStatusHistory';
import { TrackingEvent, ITrackingEvent, TrackingType } from '../models/TrackingEvent';
import { getOrderTracking, ViewerContext } from './orderTracking.service';

/**
 * Unified Tracking Service
 * 
 * PURPOSE:
 * - Provide tracking for Logistics (orders)
 * - Provide tracking for Returns (RMAs)
 * - Provide tracking for CRM (customer service)
 * - Unified API for all tracking scenarios
 * - Integrate with courier APIs
 */

export interface TrackingData {
  // Reference information
  referenceNumber: string; // Order number, RMA number, or ticket ID
  trackingType: TrackingType;
  
  // Current status
  currentStatus: string;
  statusLabel: string;
  statusDescription: string;
  
  // Timeline
  timeline: Array<{
    status: string;
    label: string;
    description: string;
    location?: string;
    timestamp: Date;
    isCompleted: boolean;
    isCurrent: boolean;
  }>;
  
  // Courier information
  courier?: {
    name: string;
    code: string;
    awbNumber?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
  };
  
  // Addresses
  pickupAddress?: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  deliveryAddress?: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  
  // Additional details
  items?: Array<{
    name: string;
    quantity: number;
    imageUrl?: string;
  }>;
  expectedDeliveryDate?: Date | null;
  estimatedDeliveryDate?: Date | null;
  
  // Metadata
  metadata?: Record<string, any>;
}

// Status labels for different tracking types
const LOGISTICS_STATUS_LABELS: Record<string, { label: string; description: string }> = {
  created: { label: 'Order Placed', description: 'Your order has been placed successfully' },
  payment_pending: { label: 'Payment Pending', description: 'Waiting for payment confirmation' },
  confirmed: { label: 'Order Confirmed', description: 'Order confirmed and payment received' },
  processing: { label: 'Preparing Shipment', description: 'Your order is being prepared for shipment' },
  shipped: { label: 'Shipped', description: 'Your order has been shipped' },
  out_for_delivery: { label: 'Out for Delivery', description: 'Your order is out for delivery' },
  delivered: { label: 'Delivered', description: 'Your order has been delivered' },
  cancelled: { label: 'Cancelled', description: 'Your order has been cancelled' },
};

const RETURNS_STATUS_LABELS: Record<string, { label: string; description: string }> = {
  requested: { label: 'Return Requested', description: 'Return request has been submitted' },
  approved: { label: 'Return Approved', description: 'Return request has been approved' },
  rejected: { label: 'Return Rejected', description: 'Return request has been rejected' },
  pickup_scheduled: { label: 'Pickup Scheduled', description: 'Pickup has been scheduled' },
  picked_up: { label: 'Picked Up', description: 'Items have been picked up' },
  in_transit: { label: 'In Transit', description: 'Return items are in transit' },
  received: { label: 'Received', description: 'Return items have been received' },
  refunded: { label: 'Refunded', description: 'Refund has been processed' },
  closed: { label: 'Closed', description: 'Return has been closed' },
};

const CRM_STATUS_LABELS: Record<string, { label: string; description: string }> = {
  created: { label: 'Ticket Created', description: 'Support ticket has been created' },
  assigned: { label: 'Assigned', description: 'Ticket has been assigned to support team' },
  in_progress: { label: 'In Progress', description: 'Ticket is being processed' },
  shipped: { label: 'Shipped', description: 'Replacement/warranty item has been shipped' },
  in_transit: { label: 'In Transit', description: 'Item is in transit' },
  delivered: { label: 'Delivered', description: 'Item has been delivered' },
  resolved: { label: 'Resolved', description: 'Ticket has been resolved' },
  closed: { label: 'Closed', description: 'Ticket has been closed' },
};

/**
 * Get tracking data for Logistics (order)
 */
export async function getLogisticsTracking(
  orderNumber: string,
  viewerContext: ViewerContext
): Promise<{ success: boolean; data?: TrackingData; error?: string }> {
  try {
    // Use existing order tracking service
    const result = await getOrderTracking(orderNumber, viewerContext);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to get order tracking' };
    }

    const orderData = result.data;

    // Get tracking events
    const order = await Order.findOne({ orderNumber }).lean();
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const trackingEvents = await TrackingEvent.find({
      orderId: order._id,
      trackingType: 'logistics',
    })
      .sort({ timestamp: 1 })
      .lean();

    // Build timeline from events and status history
    const timeline = buildTimelineFromEvents(trackingEvents, orderData.timeline, LOGISTICS_STATUS_LABELS);

    // Get courier information
    let courier: TrackingData['courier'] | undefined;
    if (orderData.courier) {
      courier = {
        name: orderData.courier.name,
        code: order.courierSnapshot?.courierCode || '',
        awbNumber: orderData.courier.awbNumber,
        trackingNumber: orderData.courier.awbNumber,
        trackingUrl: orderData.courier.trackingUrl,
      };
    }

    const trackingData: TrackingData = {
      referenceNumber: orderData.orderNumber,
      trackingType: 'logistics',
      currentStatus: orderData.orderStatus,
      statusLabel: LOGISTICS_STATUS_LABELS[orderData.orderStatus]?.label || orderData.orderStatus,
      statusDescription: LOGISTICS_STATUS_LABELS[orderData.orderStatus]?.description || `Order status: ${orderData.orderStatus}`,
      timeline,
      courier,
      pickupAddress: undefined, // Would come from shipping label
      deliveryAddress: orderData.shippingAddress,
      items: orderData.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      })),
      expectedDeliveryDate: orderData.expectedDeliveryDate,
      metadata: {
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus,
        grandTotal: orderData.grandTotal,
      },
    };

    return { success: true, data: trackingData };
  } catch (error: any) {
    console.error('[LOGISTICS TRACKING] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch logistics tracking',
    };
  }
}

/**
 * Get tracking data for Returns (RMA)
 */
export async function getReturnsTracking(
  rmaNumber: string,
  viewerContext: ViewerContext
): Promise<{ success: boolean; data?: TrackingData; error?: string }> {
  try {
    // Find RMA
    const rma = await RMA.findOne({ rmaNumber }).populate('orderId').lean();
    if (!rma) {
      return { success: false, error: 'RMA not found' };
    }

    // Validate access
    const order = rma.orderId as any as IOrder;
    const accessCheck = await validateRMAViewerAccess(rma, order, viewerContext);
    if (!accessCheck.allowed) {
      return { success: false, error: accessCheck.error || 'Access denied' };
    }

    // Get tracking events
    const trackingEvents = await TrackingEvent.find({
      rmaId: rma._id,
      trackingType: 'returns',
    })
      .sort({ timestamp: 1 })
      .lean();

    // Get shipping label
    const shippingLabel = await ShippingLabel.findOne({
      rmaId: rma._id,
      labelType: 'returns',
      status: 'generated',
    }).lean();

    // Build timeline
    const timeline = buildReturnsTimeline(rma, trackingEvents, RETURNS_STATUS_LABELS);

    // Get courier information
    let courier: TrackingData['courier'] | undefined;
    if (shippingLabel) {
      const courierDoc = await Courier.findById(shippingLabel.courierId).lean();
      let trackingUrl: string | null = null;
      const awbNumber = shippingLabel.awbNumber;

      if (courierDoc && awbNumber && courierDoc.trackingUrlTemplate) {
        trackingUrl = courierDoc.trackingUrlTemplate.replace('{{awb}}', awbNumber);
      }

      courier = {
        name: shippingLabel.courierName,
        code: shippingLabel.courierCode,
        awbNumber,
        trackingNumber: awbNumber,
        trackingUrl,
      };
    }

    const trackingData: TrackingData = {
      referenceNumber: rma.rmaNumber,
      trackingType: 'returns',
      currentStatus: rma.status,
      statusLabel: RETURNS_STATUS_LABELS[rma.status]?.label || rma.status,
      statusDescription: RETURNS_STATUS_LABELS[rma.status]?.description || `Return status: ${rma.status}`,
      timeline,
      courier,
      pickupAddress: shippingLabel?.pickupAddress,
      deliveryAddress: shippingLabel?.deliveryAddress,
      items: rma.items.map((item) => ({
        name: `Item ${item.globalVariantId}`,
        quantity: item.quantity,
      })),
      metadata: {
        returnReason: rma.items[0]?.reason,
        itemCondition: rma.items[0]?.condition,
        refundAmount: rma.refundAmount,
        refundMethod: rma.refundMethod,
      },
    };

    return { success: true, data: trackingData };
  } catch (error: any) {
    console.error('[RETURNS TRACKING] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch returns tracking',
    };
  }
}

/**
 * Get tracking data for CRM
 */
export async function getCRMTracking(
  crmTicketId: string,
  viewerContext: ViewerContext
): Promise<{ success: boolean; data?: TrackingData; error?: string }> {
  try {
    // Get tracking events
    const trackingEvents = await TrackingEvent.find({
      crmTicketId,
      trackingType: 'crm',
    })
      .sort({ timestamp: 1 })
      .lean();

    // Get shipping label
    const shippingLabel = await ShippingLabel.findOne({
      crmTicketId,
      labelType: 'crm',
      status: 'generated',
    }).lean();

    // Determine current status from latest event or default
    const currentStatus = trackingEvents.length > 0
      ? trackingEvents[trackingEvents.length - 1].status
      : 'created';

    // Build timeline
    const timeline = buildCRMTimeline(trackingEvents, CRM_STATUS_LABELS, currentStatus);

    // Get courier information
    let courier: TrackingData['courier'] | undefined;
    if (shippingLabel) {
      const courierDoc = await Courier.findById(shippingLabel.courierId).lean();
      let trackingUrl: string | null = null;
      const awbNumber = shippingLabel.awbNumber;

      if (courierDoc && awbNumber && courierDoc.trackingUrlTemplate) {
        trackingUrl = courierDoc.trackingUrlTemplate.replace('{{awb}}', awbNumber);
      }

      courier = {
        name: shippingLabel.courierName,
        code: shippingLabel.courierCode,
        awbNumber,
        trackingNumber: awbNumber,
        trackingUrl,
      };
    }

    const trackingData: TrackingData = {
      referenceNumber: crmTicketId,
      trackingType: 'crm',
      currentStatus,
      statusLabel: CRM_STATUS_LABELS[currentStatus]?.label || currentStatus,
      statusDescription: CRM_STATUS_LABELS[currentStatus]?.description || `Ticket status: ${currentStatus}`,
      timeline,
      courier,
      pickupAddress: shippingLabel?.pickupAddress,
      deliveryAddress: shippingLabel?.deliveryAddress,
      metadata: shippingLabel?.crmDetails ? (shippingLabel.crmDetails as Record<string, any>) : undefined,
    };

    return { success: true, data: trackingData };
  } catch (error: any) {
    console.error('[CRM TRACKING] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch CRM tracking',
    };
  }
}

/**
 * Build timeline from tracking events and status history
 */
function buildTimelineFromEvents(
  events: ITrackingEvent[],
  statusHistory: any[],
  statusLabels: Record<string, { label: string; description: string }>
): TrackingData['timeline'] {
  const timeline: TrackingData['timeline'] = [];

  // Add events
  events.forEach((event) => {
    const statusInfo = statusLabels[event.status] || {
      label: event.status,
      description: event.description,
    };

    timeline.push({
      status: event.status,
      label: statusInfo.label,
      description: event.description || statusInfo.description,
      location: event.location,
      timestamp: event.timestamp,
      isCompleted: true,
      isCurrent: false,
    });
  });

  // Add status history items that aren't in events
  statusHistory.forEach((item) => {
    const exists = timeline.some((t) => t.status === item.status && t.timestamp.getTime() === item.timestamp.getTime());
    if (!exists) {
      const statusInfo = statusLabels[item.status] || {
        label: item.status,
        description: item.description,
      };

      timeline.push({
        status: item.status,
        label: statusInfo.label,
        description: statusInfo.description,
        timestamp: item.timestamp,
        isCompleted: item.isCompleted,
        isCurrent: item.isCurrent,
      });
    }
  });

  // Sort by timestamp
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Mark current status
  if (timeline.length > 0) {
    const lastItem = timeline[timeline.length - 1];
    lastItem.isCurrent = true;
    lastItem.isCompleted = false;
    // Mark previous items as completed
    timeline.slice(0, -1).forEach((item) => {
      item.isCompleted = true;
      item.isCurrent = false;
    });
  }

  return timeline;
}

/**
 * Build returns timeline
 */
function buildReturnsTimeline(
  rma: IRMA,
  events: ITrackingEvent[],
  statusLabels: Record<string, { label: string; description: string }>
): TrackingData['timeline'] {
  const timeline: TrackingData['timeline'] = [];

  // Add RMA status transitions
  const statusTransitions = [
    { status: 'requested', timestamp: rma.createdAt },
    { status: 'approved', timestamp: rma.approvedAt },
    { status: 'rejected', timestamp: rma.rejectedAt },
    { status: 'received', timestamp: rma.receivedAt },
    { status: 'refunded', timestamp: rma.refundedAt },
  ].filter((t) => t.timestamp);

  statusTransitions.forEach((transition) => {
    if (!transition.timestamp) return; // Skip if no timestamp
    
    const statusInfo = statusLabels[transition.status] || {
      label: transition.status,
      description: `Return ${transition.status}`,
    };

    timeline.push({
      status: transition.status,
      label: statusInfo.label,
      description: statusInfo.description,
      timestamp: transition.timestamp,
      isCompleted: true,
      isCurrent: false,
    });
  });

  // Add tracking events
  events.forEach((event) => {
    const statusInfo = statusLabels[event.status] || {
      label: event.status,
      description: event.description,
    };

    timeline.push({
      status: event.status,
      label: statusInfo.label,
      description: event.description || statusInfo.description,
      location: event.location,
      timestamp: event.timestamp,
      isCompleted: true,
      isCurrent: false,
    });
  });

  // Sort by timestamp
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Mark current status
  if (timeline.length > 0) {
    const lastItem = timeline[timeline.length - 1];
    if (lastItem.status === rma.status) {
      lastItem.isCurrent = true;
      lastItem.isCompleted = false;
    }
    // Mark previous items as completed
    timeline.slice(0, -1).forEach((item) => {
      item.isCompleted = true;
      item.isCurrent = false;
    });
  }

  return timeline;
}

/**
 * Build CRM timeline
 */
function buildCRMTimeline(
  events: ITrackingEvent[],
  statusLabels: Record<string, { label: string; description: string }>,
  currentStatus: string
): TrackingData['timeline'] {
  const timeline: TrackingData['timeline'] = [];

  // Add events
  events.forEach((event) => {
    const statusInfo = statusLabels[event.status] || {
      label: event.status,
      description: event.description,
    };

    timeline.push({
      status: event.status,
      label: statusInfo.label,
      description: event.description || statusInfo.description,
      location: event.location,
      timestamp: event.timestamp,
      isCompleted: true,
      isCurrent: false,
    });
  });

  // Sort by timestamp
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Mark current status
  if (timeline.length > 0) {
    const lastItem = timeline[timeline.length - 1];
    if (lastItem.status === currentStatus) {
      lastItem.isCurrent = true;
      lastItem.isCompleted = false;
    }
    // Mark previous items as completed
    timeline.slice(0, -1).forEach((item) => {
      item.isCompleted = true;
      item.isCurrent = false;
    });
  } else {
    // No events, add current status
    const statusInfo = statusLabels[currentStatus] || {
      label: currentStatus,
      description: `Ticket status: ${currentStatus}`,
    };

    timeline.push({
      status: currentStatus,
      label: statusInfo.label,
      description: statusInfo.description,
      timestamp: new Date(),
      isCompleted: false,
      isCurrent: true,
    });
  }

  return timeline;
}

/**
 * Validate RMA viewer access
 */
async function validateRMAViewerAccess(
  rma: IRMA,
  order: IOrder,
  viewerContext: ViewerContext
): Promise<{ allowed: boolean; error?: string }> {
  const { type, userId, storeId } = viewerContext;

  // Admin: Full access
  if (type === 'admin') {
    return { allowed: true };
  }

  // Customer: Only own RMAs
  if (type === 'customer') {
    if (!userId) {
      return { allowed: false, error: 'User ID required' };
    }
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const rmaCustomerId = rma.customerId
      ? (typeof rma.customerId === 'string' ? new mongoose.Types.ObjectId(rma.customerId) : rma.customerId)
      : null;

    if (rmaCustomerId && userObjId.toString() === rmaCustomerId.toString()) {
      return { allowed: true };
    }

    // Also check order customer
    const orderCustomerId = order.customerId
      ? (typeof order.customerId === 'string' ? new mongoose.Types.ObjectId(order.customerId) : order.customerId)
      : null;

    if (orderCustomerId && userObjId.toString() === orderCustomerId.toString()) {
      return { allowed: true };
    }

    return { allowed: false, error: 'Access denied: Not your return' };
  }

  // Reseller: Only own store RMAs
  if (type === 'reseller') {
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    if (storeObjId && storeObjId.toString() === rma.storeId.toString()) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: Not your store return' };
  }

  return { allowed: false, error: 'Access denied' };
}

/**
 * Create tracking event
 */
export async function createTrackingEvent(params: {
  trackingType: TrackingType;
  orderId?: mongoose.Types.ObjectId | string;
  rmaId?: mongoose.Types.ObjectId | string;
  crmTicketId?: string;
  storeId: mongoose.Types.ObjectId | string;
  status: string;
  location?: string;
  description: string;
  courierId?: mongoose.Types.ObjectId | string;
  awbNumber?: string;
  source?: 'system' | 'courier_api' | 'manual' | 'webhook';
  metadata?: Record<string, any>;
}): Promise<ITrackingEvent> {
  const {
    trackingType,
    orderId,
    rmaId,
    crmTicketId,
    storeId,
    status,
    location,
    description,
    courierId,
    awbNumber,
    source = 'system',
    metadata,
  } = params;

  const event = new TrackingEvent({
    storeId: typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId,
    trackingType,
    orderId: orderId ? (typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId) : null,
    rmaId: rmaId ? (typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId) : null,
    crmTicketId: crmTicketId || null,
    status,
    location,
    description,
    courierId: courierId ? (typeof courierId === 'string' ? new mongoose.Types.ObjectId(courierId) : courierId) : null,
    awbNumber: awbNumber || null,
    source,
    metadata: metadata || {},
    timestamp: new Date(),
  });

  await event.save();
  return event;
}

