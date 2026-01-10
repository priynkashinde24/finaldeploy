import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { OrderStatusHistory } from '../models/OrderStatusHistory';
import { ShippingLabel } from '../models/ShippingLabel';
import { Courier } from '../models/Courier';
import { Store } from '../models/Store';

/**
 * Order Tracking Service
 * 
 * PURPOSE:
 * - Aggregate order tracking data for customer-facing page
 * - Build timeline from status history
 * - Resolve courier tracking URLs
 * - Ensure security and multi-tenancy
 * 
 * RULES:
 * - Never expose internal IDs
 * - Timeline derived from status history
 * - ViewerContext controls visibility
 */

export interface ViewerContext {
  type: 'customer' | 'reseller' | 'admin' | 'public';
  userId?: mongoose.Types.ObjectId | string;
  storeId?: mongoose.Types.ObjectId | string;
  email?: string; // For public tracking
  phone?: string; // For public tracking
}

export interface TimelineItem {
  status: string;
  label: string;
  description: string;
  timestamp: Date;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface OrderTrackingData {
  orderNumber: string;
  orderStatus: string;
  paymentMethod?: string;
  paymentStatus?: string;
  timeline: TimelineItem[];
  courier?: {
    name: string;
    awbNumber?: string | null;
    trackingUrl?: string | null;
  };
  shippingAddress?: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  items: Array<{
    productName: string;
    variant?: string;
    quantity: number;
    imageUrl?: string;
  }>;
  expectedDeliveryDate?: Date | null;
  grandTotal: number;
  createdAt: Date;
}

/**
 * Status label mapping for timeline
 */
const STATUS_LABELS: Record<string, { label: string; description: string }> = {
  created: { label: 'Order Placed', description: 'Your order has been placed successfully' },
  payment_pending: { label: 'Payment Pending', description: 'Waiting for payment confirmation' },
  confirmed: { label: 'Order Confirmed', description: 'Order confirmed and payment received' },
  processing: { label: 'Preparing Shipment', description: 'Your order is being prepared for shipment' },
  shipped: { label: 'Shipped', description: 'Your order has been shipped' },
  out_for_delivery: { label: 'Out for Delivery', description: 'Your order is out for delivery' },
  delivered: { label: 'Delivered', description: 'Your order has been delivered' },
  cancelled: { label: 'Cancelled', description: 'Your order has been cancelled' },
  returned: { label: 'Returned', description: 'Your order has been returned' },
  refunded: { label: 'Refunded', description: 'Your order has been refunded' },
};

/**
 * Get order tracking data
 */
export async function getOrderTracking(
  orderNumber: string,
  viewerContext: ViewerContext
): Promise<{ success: boolean; data?: OrderTrackingData; error?: string }> {
  try {
    // Find order by orderNumber
    const order = await Order.findOne({ orderNumber }).lean();
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    const orderObjId = order._id;
    const storeObjId = order.storeId;

    // Security: Validate viewer access
    const accessCheck = await validateViewerAccess(order, viewerContext);
    if (!accessCheck.allowed) {
      return {
        success: false,
        error: accessCheck.error || 'Access denied',
      };
    }

    // Get status history for timeline
    const statusHistory = await OrderStatusHistory.find({
      orderId: orderObjId,
    })
      .sort({ timestamp: 1 })
      .lean();

    // Build timeline
    const timeline: TimelineItem[] = [];
    const currentStatus = order.orderStatus || order.status;

    // Add all status transitions from history
    statusHistory.forEach((history) => {
      const statusInfo = STATUS_LABELS[history.toStatus] || {
        label: history.toStatus,
        description: `Order status: ${history.toStatus}`,
      };

      timeline.push({
        status: history.toStatus,
        label: statusInfo.label,
        description: statusInfo.description,
        timestamp: history.timestamp,
        isCompleted: true,
        isCurrent: false,
      });
    });

    // Mark current status
    if (timeline.length > 0) {
      const lastItem = timeline[timeline.length - 1];
      if (lastItem.status === currentStatus) {
        lastItem.isCurrent = true;
        lastItem.isCompleted = false;
      }
    } else {
      // No history yet, add current status
      const statusInfo = STATUS_LABELS[currentStatus] || {
        label: currentStatus,
        description: `Order status: ${currentStatus}`,
      };
      timeline.push({
        status: currentStatus,
        label: statusInfo.label,
        description: statusInfo.description,
        timestamp: order.createdAt || new Date(),
        isCompleted: false,
        isCurrent: true,
      });
    }

    // Get courier information
    let courier: OrderTrackingData['courier'] | undefined;
    if (order.courierSnapshot) {
      const courierDoc = await Courier.findById(order.courierSnapshot.courierId).lean();
      const shippingLabel = await ShippingLabel.findOne({
        orderId: orderObjId,
        status: 'generated',
      }).lean();

      let trackingUrl: string | null = null;
      const awbNumber = shippingLabel?.awbNumber || order.metadata?.trackingNumber || null;

      // Resolve tracking URL
      if (courierDoc && awbNumber) {
        // Check if courier has trackingUrlTemplate
        if (courierDoc.trackingUrlTemplate) {
          trackingUrl = courierDoc.trackingUrlTemplate.replace('{{awb}}', awbNumber);
        }
      }

      courier = {
        name: order.courierSnapshot.courierName,
        awbNumber,
        trackingUrl: trackingUrl || null,
      };
    }

    // Build items list
    const items = order.items.map((item) => ({
      productName: item.name || 'Product',
      variant: item.sku || undefined,
      quantity: item.quantity,
      imageUrl: undefined, // IOrderItem doesn't have imageUrl
    }));

    // Calculate expected delivery date (estimate: 3-5 business days from shipped)
    let expectedDeliveryDate: Date | null = null;
    if (order.orderStatus === 'shipped' || order.orderStatus === 'out_for_delivery') {
      const shippedHistory = statusHistory.find((h) => h.toStatus === 'shipped');
      if (shippedHistory) {
        const deliveryDate = new Date(shippedHistory.timestamp);
        deliveryDate.setDate(deliveryDate.getDate() + 4); // 4 days estimate
        expectedDeliveryDate = deliveryDate;
      }
    }

    // Build shipping address (mask sensitive data for public)
    let shippingAddress: OrderTrackingData['shippingAddress'] | undefined;
    if (order.shippingAddress) {
      shippingAddress = {
        name: viewerContext.type === 'public' ? '***' : order.customerName || 'Customer',
        street: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.zip,
        country: order.shippingAddress.country,
      };
    }

    const trackingData: OrderTrackingData = {
      orderNumber: order.orderNumber || order.orderId,
      orderStatus: currentStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      timeline,
      courier,
      shippingAddress,
      items,
      expectedDeliveryDate,
      grandTotal: order.grandTotal || order.totalAmountWithTax || 0,
      createdAt: order.createdAt || new Date(),
    };

    return {
      success: true,
      data: trackingData,
    };
  } catch (error: any) {
    console.error('[ORDER TRACKING] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch order tracking',
    };
  }
}

/**
 * Validate viewer access to order
 */
async function validateViewerAccess(
  order: IOrder,
  viewerContext: ViewerContext
): Promise<{ allowed: boolean; error?: string }> {
  const { type, userId, storeId, email, phone } = viewerContext;

  // Admin: Full access
  if (type === 'admin') {
    return { allowed: true };
  }

  // Reseller: Only own store orders
  if (type === 'reseller') {
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    if (storeObjId && storeObjId.toString() === order.storeId.toString()) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: Not your store order' };
  }

  // Customer: Only own orders
  if (type === 'customer') {
    if (!userId) {
      return { allowed: false, error: 'User ID required' };
    }
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const orderCustomerId =
      typeof order.customerId === 'string'
        ? new mongoose.Types.ObjectId(order.customerId)
        : order.customerId;

    if (orderCustomerId && userObjId.toString() === orderCustomerId.toString()) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: Not your order' };
  }

  // Public: Verify email/phone match
  if (type === 'public') {
    // TODO: Implement public tracking with email/phone verification
    // For now, allow if email matches
    if (email && order.customerEmail && email.toLowerCase() === order.customerEmail.toLowerCase()) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: Email/phone verification required' };
  }

  return { allowed: false, error: 'Invalid viewer context' };
}

