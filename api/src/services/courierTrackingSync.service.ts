import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { ShippingLabel } from '../models/ShippingLabel';
import { Courier } from '../models/Courier';
import { createCourierApiClient } from './courierApi/courierApi.factory';
import { transitionOrder } from './orderLifecycle.service';
import { OrderStatus } from '../constants/orderStatus';

/**
 * Courier Tracking Sync Service
 * 
 * PURPOSE:
 * - Sync tracking status from courier APIs
 * - Update order status based on courier tracking
 * - Poll courier APIs for updates
 * - Handle webhook updates
 * 
 * RULES:
 * - Only sync if courier has API enabled
 * - Map courier status to order status
 * - Update order only if status changed
 */

export interface SyncTrackingResult {
  success: boolean;
  orderId?: string;
  statusUpdated?: boolean;
  error?: string;
}

/**
 * Sync tracking status for a single order
 */
export async function syncOrderTracking(
  orderId: mongoose.Types.ObjectId | string
): Promise<SyncTrackingResult> {
  try {
    const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;

    // Get order with shipping label
    const order = await Order.findById(orderObjId).lean();
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    // Get shipping label
    const shippingLabel = await ShippingLabel.findOne({
      orderId: orderObjId,
      status: 'generated',
    }).lean();

    if (!shippingLabel || !shippingLabel.awbNumber) {
      return {
        success: false,
        error: 'No AWB number found for order',
      };
    }

    // Get courier
    const courier = await Courier.findById(order.courierSnapshot?.courierId).lean();
    if (!courier || !courier.apiConfig?.enabled) {
      return {
        success: false,
        error: 'Courier API not enabled',
      };
    }

    // Create courier API client
    const apiClient = createCourierApiClient(courier.apiConfig);
    if (!apiClient) {
      return {
        success: false,
        error: 'Failed to create courier API client',
      };
    }

    // Get tracking status
    const trackingResult = await apiClient.getTrackingStatus(shippingLabel.awbNumber);
    if (!trackingResult.success || !trackingResult.data) {
      return {
        success: false,
        error: trackingResult.error || 'Failed to fetch tracking status',
      };
    }

    const trackingStatus = trackingResult.data;

    // Map courier status to order status
    const orderStatus = mapCourierStatusToOrderStatus(trackingStatus.status);

    // Update order status if changed
    let statusUpdated = false;
    if (orderStatus && orderStatus !== order.orderStatus) {
      const transitionResult = await transitionOrder({
        orderId: orderObjId,
        toStatus: orderStatus as OrderStatus,
        actorRole: 'system',
        metadata: {
          reason: 'Courier tracking sync',
          trackingNumber: shippingLabel.awbNumber,
          courierStatus: trackingStatus.status,
          courierLocation: trackingStatus.location,
        },
      });

      if (transitionResult.success) {
        statusUpdated = true;
      }
    }

    // Update shipping label with latest tracking info
    await ShippingLabel.updateOne(
      { _id: shippingLabel._id },
      {
        $set: {
          'metadata.lastTrackingSync': new Date(),
          'metadata.courierStatus': trackingStatus.status,
          'metadata.courierLocation': trackingStatus.location,
          'metadata.estimatedDelivery': trackingStatus.estimatedDelivery,
        },
      }
    );

    return {
      success: true,
      orderId: order.orderId,
      statusUpdated,
    };
  } catch (error: any) {
    console.error('[COURIER TRACKING SYNC] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync tracking',
    };
  }
}

/**
 * Sync tracking for multiple orders
 */
export async function syncMultipleOrdersTracking(
  orderIds: (mongoose.Types.ObjectId | string)[]
): Promise<SyncTrackingResult[]> {
  const results = await Promise.allSettled(
    orderIds.map((orderId) => syncOrderTracking(orderId))
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    }
  });
}

/**
 * Map courier status to order status
 */
function mapCourierStatusToOrderStatus(courierStatus: string): string | null {
  const statusLower = courierStatus.toLowerCase();

  if (statusLower.includes('delivered')) {
    return 'delivered';
  } else if (statusLower.includes('out for delivery') || statusLower.includes('ofd')) {
    return 'out_for_delivery';
  } else if (statusLower.includes('shipped') || statusLower.includes('dispatched') || statusLower.includes('in transit')) {
    return 'shipped';
  } else if (statusLower.includes('processing') || statusLower.includes('confirmed')) {
    return 'processing';
  }

  return null; // Unknown status, don't update
}

