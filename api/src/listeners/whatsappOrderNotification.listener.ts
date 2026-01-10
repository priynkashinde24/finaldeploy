import { eventStreamEmitter } from '../controllers/eventController';
import { sendOrderNotification } from '../services/whatsappNotification.service';
import { OrderLifecycleEvent } from '../constants/whatsappTemplates';
import mongoose from 'mongoose';

/**
 * WhatsApp Order Notification Listener
 *
 * PURPOSE:
 * - Listen for order lifecycle events
 * - Trigger WhatsApp notifications asynchronously
 * - Never block order flow
 *
 * EVENTS HANDLED:
 * - ORDER_CREATED → ORDER_PLACED (customer)
 * - ORDER_CONFIRMED → ORDER_CONFIRMED (customer, reseller)
 * - ORDER_SHIPPED → ORDER_SHIPPED (customer)
 * - ORDER_OUT_FOR_DELIVERY → ORDER_OUT_FOR_DELIVERY (customer)
 * - ORDER_DELIVERED → ORDER_DELIVERED (customer, reseller)
 * - ORDER_CANCELLED → ORDER_CANCELLED (customer)
 * - ORDER_REFUNDED → ORDER_REFUNDED (customer)
 * - ORDER_ASSIGNED → ORDER_ASSIGNED (supplier)
 * - ORDER_READY_TO_SHIP → ORDER_READY_TO_SHIP (supplier)
 */

/**
 * Map order lifecycle events to WhatsApp notification events
 */
const EVENT_MAPPING: Record<string, { eventType: OrderLifecycleEvent; roles: Array<'customer' | 'supplier' | 'reseller'> }> = {
  ORDER_CREATED: {
    eventType: 'ORDER_PLACED',
    roles: ['customer'],
  },
  ORDER_CONFIRMED: {
    eventType: 'ORDER_CONFIRMED',
    roles: ['customer', 'reseller'],
  },
  ORDER_PROCESSING: {
    eventType: 'ORDER_ASSIGNED',
    roles: ['supplier'],
  },
  ORDER_ASSIGNED: {
    eventType: 'ORDER_ASSIGNED',
    roles: ['supplier'],
  },
  ORDER_SHIPPED: {
    eventType: 'ORDER_SHIPPED',
    roles: ['customer'],
  },
  ORDER_OUT_FOR_DELIVERY: {
    eventType: 'ORDER_OUT_FOR_DELIVERY',
    roles: ['customer'],
  },
  ORDER_DELIVERED: {
    eventType: 'ORDER_DELIVERED',
    roles: ['customer', 'reseller'],
  },
  ORDER_CANCELLED: {
    eventType: 'ORDER_CANCELLED',
    roles: ['customer'],
  },
  ORDER_REFUNDED: {
    eventType: 'ORDER_REFUNDED',
    roles: ['customer'],
  },
  LABEL_GENERATED: {
    eventType: 'ORDER_READY_TO_SHIP',
    roles: ['supplier'],
  },
  ORDER_READY_TO_SHIP: {
    eventType: 'ORDER_READY_TO_SHIP',
    roles: ['supplier'],
  },
};

export function initializeWhatsAppOrderNotificationListeners(): void {
  eventStreamEmitter.on('event', async (event: any) => {
    const eventMapping = EVENT_MAPPING[event.eventType];

    if (!eventMapping) {
      return; // Not an order lifecycle event we handle
    }

    try {
      const { orderId, storeId } = event.payload || {};

      if (!orderId || !storeId) {
        console.warn(
          `[WHATSAPP ORDER NOTIFICATION] Missing orderId or storeId in ${event.eventType} event`
        );
        return;
      }

      // Send notifications for each role asynchronously (don't await)
      for (const role of eventMapping.roles) {
        // Fire and forget - never block order flow
        sendOrderNotification({
          orderId,
          storeId,
          eventType: eventMapping.eventType,
          role,
        }).catch((error) => {
          console.error(
            `[WHATSAPP ORDER NOTIFICATION] Error sending ${eventMapping.eventType} notification to ${role}:`,
            error
          );
        });
      }
    } catch (error: any) {
      // Never throw - this is async and should not affect order processing
      console.error(`[WHATSAPP ORDER NOTIFICATION] Error handling ${event.eventType}:`, error);
    }
  });

  console.log('[WHATSAPP ORDER NOTIFICATION LISTENER] Initialized');
}

