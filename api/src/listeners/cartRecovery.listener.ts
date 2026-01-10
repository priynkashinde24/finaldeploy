import { eventStreamEmitter } from '../controllers/eventController';
import { scheduleCartRecovery } from '../services/cartRecoveryScheduler';
import { scheduleWhatsAppRecovery } from '../services/cartRecoveryWhatsAppScheduler';
import mongoose from 'mongoose';

/**
 * Cart Recovery Event Listener
 *
 * PURPOSE:
 * - Listen for CART_ABANDONED events
 * - Automatically schedule recovery emails
 * - Prevent duplicate scheduling
 */

/**
 * Initialize cart recovery event listeners
 */
export function initializeCartRecoveryListeners(): void {
  // Listen for CART_ABANDONED events
  eventStreamEmitter.on('event', async (event: any) => {
    if (event.eventType === 'CART_ABANDONED') {
      try {
        const { cartId, storeId, email, userId } = event.payload;

        if (!cartId || !storeId || !email) {
          console.warn('[CART RECOVERY LISTENER] Missing required fields in CART_ABANDONED event');
          return;
        }

        // Schedule recovery emails
        const result = await scheduleCartRecovery({
          cartId: new mongoose.Types.ObjectId(cartId),
          storeId: new mongoose.Types.ObjectId(storeId),
          email,
          userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        });

        if (!result.success) {
          console.error(`[CART RECOVERY LISTENER] Failed to schedule recovery: ${result.error}`);
        } else {
          console.log(`[CART RECOVERY LISTENER] Recovery scheduled for cart ${cartId}`);
        }
      } catch (error: any) {
        console.error('[CART RECOVERY LISTENER] Error handling CART_ABANDONED event:', error);
      }
    }
  });

  // Listen for CART_ABANDONED events for WhatsApp recovery
  eventStreamEmitter.on('event', async (event: any) => {
    if (event.eventType === 'CART_ABANDONED') {
      try {
        const { cartId, storeId, userId } = event.payload;

        if (!cartId || !storeId) {
          return;
        }

        // Schedule WhatsApp recovery (if user has phone and opted in)
        // This will check opt-in internally
        const whatsappResult = await scheduleWhatsAppRecovery({
          cartId: new mongoose.Types.ObjectId(cartId),
          storeId: new mongoose.Types.ObjectId(storeId),
          userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        });

        if (!whatsappResult.success && whatsappResult.error !== 'User has not opted in to WhatsApp messages') {
          console.error(`[CART RECOVERY LISTENER] Failed to schedule WhatsApp recovery: ${whatsappResult.error}`);
        } else if (whatsappResult.success) {
          console.log(`[CART RECOVERY LISTENER] WhatsApp recovery scheduled for cart ${cartId}`);
        }
      } catch (error: any) {
        console.error('[CART RECOVERY LISTENER] Error handling WhatsApp recovery:', error);
      }
    }
  });

  console.log('[CART RECOVERY LISTENER] Initialized (Email + WhatsApp)');
}

