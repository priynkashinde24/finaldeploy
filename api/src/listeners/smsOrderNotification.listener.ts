import { eventStreamEmitter } from '../controllers/eventController';
import { sendOrderSMS } from '../services/smsNotification.service';
import { OrderLifecycleEvent } from '../constants/smsTemplates';
import mongoose from 'mongoose';

/**
 * SMS Order Notification Listener
 *
 * PURPOSE:
 * - Listen for order lifecycle events
 * - Trigger SMS notifications asynchronously
 * - Never block order flow
 * - Support WhatsApp fallback mode
 *
 * EVENTS HANDLED:
 * - ORDER_CONFIRMED → ORDER_CONFIRMED (customer, reseller)
 * - ORDER_SHIPPED → ORDER_SHIPPED (customer)
 * - ORDER_OUT_FOR_DELIVERY → ORDER_OUT_FOR_DELIVERY (customer)
 * - ORDER_DELIVERED → ORDER_DELIVERED (customer, reseller)
 * - ORDER_CANCELLED → ORDER_CANCELLED (customer)
 * - ORDER_REFUNDED → ORDER_REFUNDED (customer)
 */

/**
 * Map order lifecycle events to SMS notification events
 */
const EVENT_MAPPING: Record<string, { eventType: OrderLifecycleEvent; roles: Array<'customer' | 'supplier' | 'reseller'> }> = {
  ORDER_CONFIRMED: {
    eventType: 'ORDER_CONFIRMED',
    roles: ['customer', 'reseller'],
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
};

/**
 * Check if SMS should be sent as fallback from WhatsApp
 * This listens to WhatsApp notification failure events
 */
async function handleWhatsAppFallback(event: any): Promise<void> {
  if (event.eventType === 'WHATSAPP_ORDER_NOTIFICATION_FAILED') {
    const { orderId, storeId, eventType, role } = event.payload || {};
    
    if (!orderId || !storeId || !eventType || !role) {
      return;
    }

    // Map WhatsApp event type to SMS event type
    const smsEventMapping: Record<string, OrderLifecycleEvent> = {
      'ORDER_PLACED': 'ORDER_CONFIRMED', // Approximate mapping
      'ORDER_CONFIRMED': 'ORDER_CONFIRMED',
      'ORDER_SHIPPED': 'ORDER_SHIPPED',
      'ORDER_OUT_FOR_DELIVERY': 'ORDER_OUT_FOR_DELIVERY',
      'ORDER_DELIVERED': 'ORDER_DELIVERED',
      'ORDER_CANCELLED': 'ORDER_CANCELLED',
      'ORDER_REFUNDED': 'ORDER_REFUNDED',
    };

    const smsEventType = smsEventMapping[eventType];
    if (!smsEventType) {
      return; // No SMS equivalent
    }

    // Check if SMS fallback is enabled for this store
    const { Store } = await import('../models/Store');
    const store = await Store.findById(storeId).select('metadata').lean();
    const smsConfig = (store as any)?.metadata?.smsNotifications || {};
    
    if (smsConfig.smsFallbackEnabled === false) {
      return; // SMS fallback disabled
    }

    // Send SMS as fallback
    try {
      await sendOrderSMS({
        orderId,
        storeId,
        eventType: smsEventType,
        role: role as 'customer' | 'supplier' | 'reseller',
        isFallback: true,
      });
    } catch (error: any) {
      console.error(`[SMS ORDER NOTIFICATION] Error sending fallback SMS for ${eventType}:`, error);
    }
  }
}

export function initializeSMSOrderNotificationListeners(): void {
  // Listen for order lifecycle events
  eventStreamEmitter.on('event', async (event: any) => {
    const eventMapping = EVENT_MAPPING[event.eventType];

    if (!eventMapping) {
      // Check if this is a WhatsApp failure event (for fallback)
      await handleWhatsAppFallback(event);
      return;
    }

    try {
      const { orderId, storeId } = event.payload || {};

      if (!orderId || !storeId) {
        console.warn(
          `[SMS ORDER NOTIFICATION] Missing orderId or storeId in ${event.eventType} event`
        );
        return;
      }

      // Check if SMS fallback mode is enabled
      // If enabled, only send SMS if WhatsApp fails
      // For now, we send SMS directly (can be enhanced to check WhatsApp status first)
      const { Store } = await import('../models/Store');
      const store = await Store.findById(storeId).select('metadata').lean();
      const smsConfig = (store as any)?.metadata?.smsNotifications || {};
      
      // If SMS fallback is enabled, don't send SMS directly (wait for WhatsApp failure)
      if (smsConfig.smsFallbackEnabled === true && smsConfig.smsOnlyMode !== true) {
        // Wait for WhatsApp to fail first (handled by handleWhatsAppFallback)
        return;
      }

      // Send notifications for each role asynchronously (don't await)
      for (const role of eventMapping.roles) {
        // Fire and forget - never block order flow
        sendOrderSMS({
          orderId,
          storeId,
          eventType: eventMapping.eventType,
          role,
        }).catch((error) => {
          console.error(
            `[SMS ORDER NOTIFICATION] Error sending ${eventMapping.eventType} notification to ${role}:`,
            error
          );
        });
      }
    } catch (error: any) {
      // Never throw - this is async and should not affect order processing
      console.error(`[SMS ORDER NOTIFICATION] Error handling ${event.eventType}:`, error);
    }
  });

  console.log('[SMS ORDER NOTIFICATION LISTENER] Initialized');
}

