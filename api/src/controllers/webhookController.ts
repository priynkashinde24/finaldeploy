import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/responseFormatter';
import { syncSupplierProducts, handleProductUpdate } from '../sync/supplierSyncWorker';
import { Order } from '../models/Order';
import { PayoutLedger } from '../models/PayoutLedger';
import { eventStreamEmitter } from './eventController';

/**
 * Webhook receiver for supplier sync events
 * 
 * This is a stub implementation. Future enhancements:
 * - Verify webhook signatures
 * - Handle different event types (product.created, product.updated, product.deleted)
 * - Queue sync jobs instead of processing immediately
 * - Add retry logic and error handling
 */
export const supplierSyncWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Log webhook request
    console.log('[WEBHOOK] Supplier sync webhook received:', {
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    const { event, supplierId, productId } = req.body;

    // Handle different event types
    switch (event) {
      case 'product.updated':
      case 'product.created':
        if (productId) {
          await handleProductUpdate(productId);
        }
        break;

      case 'supplier.sync':
        if (supplierId) {
          await syncSupplierProducts(supplierId);
        }
        break;

      default:
        console.log(`[WEBHOOK] Unknown event type: ${event}`);
    }

    // Respond immediately (async processing)
    sendSuccess(res, { status: 'received' }, 'Webhook received and queued for processing');
  } catch (error) {
    // Log error but still respond 200 to prevent webhook retries
    console.error('[WEBHOOK] Error processing webhook:', error);
    sendSuccess(res, { status: 'received', error: 'Processing failed' }, 'Webhook received');
  }
};

/**
 * Webhook receiver for Stripe payment intent success
 * POST /api/webhooks/payment-intent-success
 * 
 * This is a stub implementation. Future enhancements:
 * - Verify Stripe webhook signatures
 * - Handle actual Stripe transfer creation
 * - Add retry logic and error handling
 */
export const paymentIntentSuccessWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Log webhook request
    console.log('[WEBHOOK] Payment intent success webhook received:', {
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    const { paymentIntentId, orderId, transferGroup } = req.body;

    // Find order by paymentIntentId or orderId
    let order;
    if (paymentIntentId) {
      order = await Order.findOne({ paymentIntentId });
    } else if (orderId) {
      order = await Order.findOne({ orderId });
    } else if (transferGroup) {
      order = await Order.findOne({ orderId: transferGroup });
    }

    if (!order) {
      console.error('[WEBHOOK] Order not found for payment intent:', { paymentIntentId, orderId, transferGroup });
      sendSuccess(res, { status: 'received', error: 'Order not found' }, 'Webhook received');
      return;
    }

    // Update order status to paid
    order.status = 'paid';
    await order.save();

    // Consume variant inventory (convert reservation to consumed)
    try {
      const { consumeInventory } = await import('../services/inventoryReservation.service');
      const consumeResult = await consumeInventory(order._id, { storeId: order.storeId.toString() });
      if (!consumeResult.success) {
        console.error('[WEBHOOK] Failed to consume inventory for order:', order.orderId, consumeResult.error);
        // Don't fail the webhook, but log the error
      }
    } catch (error: any) {
      console.error('[WEBHOOK] Error consuming inventory:', error);
      // Don't fail the webhook
    }

    // Emit order.paid event
    eventStreamEmitter.emit('event', {
      eventType: 'order.paid',
      payload: {
        orderId: order.orderId,
        storeId: order.storeId,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmount || order.totalAmount,
        discountAmount: order.discountAmount || 0,
      },
      storeId: order.storeId,
      userId: order.customerEmail || undefined,
      occurredAt: new Date(),
    });

    // Update payout ledger status to completed
    const payoutLedger = await PayoutLedger.findOne({ orderId: order.orderId });
    if (payoutLedger) {
      payoutLedger.status = 'paid';
      await payoutLedger.save();
    } else {
      console.warn('[WEBHOOK] Payout ledger not found for order:', order.orderId);
    }

    // TODO: In future, create actual Stripe transfers here
    // - Transfer supplierAmount to supplier's Stripe Connect account
    // - Transfer resellerAmount to reseller's Stripe Connect account
    // - Keep platformFee in platform account

    console.log('[WEBHOOK] Order marked as paid:', order.orderId);

    sendSuccess(res, { status: 'processed', orderId: order.orderId }, 'Payment processed successfully');
  } catch (error) {
    // Log error but still respond 200 to prevent webhook retries
    console.error('[WEBHOOK] Error processing payment webhook:', error);
    sendSuccess(res, { status: 'received', error: 'Processing failed' }, 'Webhook received');
  }
};

