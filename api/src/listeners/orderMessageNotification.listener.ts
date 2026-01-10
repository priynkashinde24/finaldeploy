import { eventStreamEmitter } from '../controllers/eventController';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { OrderMessageThread } from '../models/OrderMessageThread';
import { User } from '../models/User';

/**
 * Order Message Notification Listener
 *
 * PURPOSE:
 * - Listen for MESSAGE_CREATED events
 * - Notify relevant roles (admin, supplier, reseller when customer messages)
 * - Notify customer when admin/supplier/reseller replies
 * - Respect notification preferences
 * - Avoid notification loops (don't notify on channel messages)
 *
 * RULES:
 * - Customer message → notify admin/supplier/reseller
 * - Admin/Supplier/Reseller reply → notify customer
 * - Don't notify if message came from external channel (to avoid loops)
 */

export function initializeOrderMessageNotificationListeners(): void {
  eventStreamEmitter.on('event', async (event: any) => {
    if (event.eventType !== 'MESSAGE_CREATED') {
      return; // Not a message event
    }

    try {
      const { orderId, storeId, senderRole, channel, source } = event.payload || {};

      if (!orderId || !storeId) {
        console.warn('[ORDER MESSAGE NOTIFICATION] Missing orderId or storeId in MESSAGE_CREATED event');
        return;
      }

      // Don't send notifications for system events or if source is inbound_channel (to avoid loops)
      if (senderRole === 'system' || source === 'inbound_channel') {
        return;
      }

      // Get order and thread
      const order = await Order.findOne({ orderId }).lean();
      if (!order) {
        console.warn(`[ORDER MESSAGE NOTIFICATION] Order not found: ${orderId}`);
        return;
      }

      const thread = await OrderMessageThread.findOne({ orderId, storeId: order.storeId }).lean();
      if (!thread) {
        console.warn(`[ORDER MESSAGE NOTIFICATION] Thread not found for order: ${orderId}`);
        return;
      }

      // Determine who to notify based on sender role
      if (senderRole === 'customer') {
        // Customer message → notify admin, supplier, reseller
        await notifyStaff(order, thread, 'customer_message');
      } else if (['admin', 'supplier', 'reseller'].includes(senderRole)) {
        // Staff reply → notify customer
        await notifyCustomer(order, thread, 'staff_reply');
      }

      // TODO: In the future, you can integrate with:
      // - Email notification service
      // - Push notification service
      // - In-app notification system
      // - WebSocket/SSE for real-time updates
    } catch (error: any) {
      // Never throw - this is async and should not affect message creation
      console.error('[ORDER MESSAGE NOTIFICATION] Error handling MESSAGE_CREATED:', error);
    }
  });

  console.log('[ORDER MESSAGE NOTIFICATION LISTENER] Initialized');
}

/**
 * Notify staff (admin, supplier, reseller) about customer message
 */
async function notifyStaff(order: any, thread: any, eventType: string): Promise<void> {
  try {
    const storeId = typeof order.storeId === 'string' 
      ? new mongoose.Types.ObjectId(order.storeId) 
      : order.storeId;

    // Find admin users (can be extended to find all relevant staff)
    // For now, we'll just log. In production, you'd:
    // 1. Find admin users for the store
    // 2. Find supplier users for the order
    // 3. Find reseller (store owner)
    // 4. Send notifications via email/push/in-app

    console.log(`[ORDER MESSAGE NOTIFICATION] Customer message in order ${order.orderId} - staff should be notified`);

    // TODO: Implement actual notification sending
    // Example:
    // - Send email to admin/supplier/reseller
    // - Create in-app notification
    // - Send push notification (if enabled)
  } catch (error: any) {
    console.error('[ORDER MESSAGE NOTIFICATION] Error notifying staff:', error);
  }
}

/**
 * Notify customer about staff reply
 */
async function notifyCustomer(order: any, thread: any, eventType: string): Promise<void> {
  try {
    if (!order.customerId) {
      // No customer ID - might be guest order
      return;
    }

    const customerId = typeof order.customerId === 'string' 
      ? new mongoose.Types.ObjectId(order.customerId) 
      : order.customerId;

    const customer = await User.findById(customerId).lean();
    if (!customer) {
      return;
    }

    console.log(`[ORDER MESSAGE NOTIFICATION] Staff reply in order ${order.orderId} - customer should be notified`);

    // TODO: Implement actual notification sending
    // Example:
    // - Send email to customer
    // - Send SMS/WhatsApp (if opt-in)
    // - Create in-app notification
    // - Send push notification (if enabled)
  } catch (error: any) {
    console.error('[ORDER MESSAGE NOTIFICATION] Error notifying customer:', error);
  }
}

