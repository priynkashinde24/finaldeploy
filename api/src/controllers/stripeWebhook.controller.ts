import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { stripe } from '../lib/stripe';
import { PaymentIntent } from '../models/PaymentIntent';
import { StripeWebhookEvent } from '../models/StripeWebhookEvent';
import { Order } from '../models/Order';
import { Subscription } from '../models/Subscription';
import { consumeInventory, releaseInventory } from '../services/inventoryReservation.service';
import { eventStreamEmitter } from './eventController';
import { logAudit } from '../utils/auditLogger';
import { WebhookRetry } from '../models/WebhookRetry';
import { processSupplierPayout } from '../services/stripeConnectPayout.service';
import { SupplierPayout } from '../models/SupplierPayout';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';

/**
 * Stripe Webhook Controller
 * 
 * PURPOSE:
 * - Handle Stripe webhook events
 * - Verify webhook signatures
 * - Process payment success/failure
 * - Handle subscription events
 * - Idempotent processing
 * 
 * SECURITY:
 * - Webhook endpoint NOT behind auth
 * - Always validate Stripe signature
 * - Never trust frontend success
 */

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
    sendError(res, 'Webhook secret not configured', 500);
    return;
  }

  let event: Stripe.Event;

  try {
    // STEP 1: Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
    sendError(res, `Webhook signature verification failed: ${err.message}`, 400);
    return;
  }

  // STEP 2: Check idempotency (prevent duplicate processing)
  const existingEvent = await StripeWebhookEvent.findOne({
    stripeEventId: event.id,
  });

  if (existingEvent && existingEvent.processed) {
    console.log(`[STRIPE WEBHOOK] Event ${event.id} already processed, skipping`);
    sendSuccess(res, { status: 'already_processed' }, 'Event already processed');
    return;
  }

  // STEP 3: Record event (for idempotency)
  let webhookEvent = await StripeWebhookEvent.findOneAndUpdate(
    { stripeEventId: event.id },
    {
      $setOnInsert: {
        stripeEventId: event.id,
        eventType: event.type,
        processed: false,
        metadata: {
          livemode: event.livemode,
          apiVersion: event.api_version,
        },
      },
    },
    { upsert: true, new: true }
  );

  try {
    // STEP 4: Handle event based on type
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // STEP 5: Mark event as processed
    webhookEvent.processed = true;
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();

    sendSuccess(res, { status: 'processed', eventId: event.id }, 'Webhook processed successfully');
  } catch (error: any) {
    console.error(`[STRIPE WEBHOOK] Error processing event ${event.id}:`, error);

    // Mark event as failed
    webhookEvent.processed = false;
    webhookEvent.error = error.message;
    await webhookEvent.save();

    // Create retry record for failed webhook
    await WebhookRetry.findOneAndUpdate(
      { stripeEventId: event.id },
      {
        $setOnInsert: {
          stripeEventId: event.id,
          eventType: event.type,
          retryCount: 0,
          status: 'pending',
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
          error: error.message,
          maxRetries: 5,
          metadata: {
            livemode: event.livemode,
            apiVersion: event.api_version,
          },
        },
      },
      { upsert: true }
    );

    // Still return 200 to prevent Stripe retries (we'll handle manually)
    sendSuccess(res, { status: 'error', error: error.message }, 'Webhook received but processing failed');
  }
};

/**
 * Process supplier payouts for an order (async helper)
 */
async function processSupplierPayoutsForOrder(
  orderId: mongoose.Types.ObjectId,
  storeId: string
): Promise<void> {
  try {
    const { Order } = await import('../models/Order');
    const order = await Order.findById(orderId);
    if (!order) return;

    const payouts = await SupplierPayout.find({
      orderId: order.orderId,
      payoutStatus: 'pending',
    });

    for (const payout of payouts) {
      const result = await processSupplierPayout({
        supplierPayoutId: payout._id,
        storeId: storeId,
      });

      if (!result.success) {
        console.error(`[STRIPE WEBHOOK] Failed to process payout ${payout._id}:`, result.error);
      }
    }
  } catch (error: any) {
    console.error('[STRIPE WEBHOOK] Error processing payouts:', error);
  }
}

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  await withTransaction(async (session) => {
    // STEP 1: Find PaymentIntent record
    const paymentIntentRecord = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    }).session(session);

    if (!paymentIntentRecord) {
      throw new Error(`PaymentIntent not found for Stripe PaymentIntent ${paymentIntent.id}`);
    }

    // STEP 2: Check if already processed
    if (paymentIntentRecord.paymentStatus === 'paid') {
      console.log(`[STRIPE WEBHOOK] PaymentIntent ${paymentIntent.id} already marked as paid`);
      return;
    }

    // STEP 3: Update PaymentIntent
    paymentIntentRecord.status = paymentIntent.status;
    paymentIntentRecord.paymentStatus = 'paid';
    paymentIntentRecord.stripeEventId = event.id;
    await paymentIntentRecord.save({ session });

    // STEP 4: Update Order
    if (paymentIntentRecord.orderId) {
      const order = await Order.findById(paymentIntentRecord.orderId).session(session);
      if (order) {
        order.status = 'paid';
        await order.save({ session });

        // STEP 5: Consume inventory reservation
        const consumeResult = await consumeInventory(order._id, {
          storeId: order.storeId.toString(),
        });

        if (!consumeResult.success) {
          console.error(
            `[STRIPE WEBHOOK] Failed to consume inventory for order ${order.orderId}:`,
            consumeResult.error
          );
          // Don't fail the transaction, but log the error
        }

        // STEP 6: Create payment split (ledger-based)
        const { createPaymentSplit } = await import('../services/splitPayment.service');
        const splitResult = await createPaymentSplit({
          order,
          paymentId: paymentIntentRecord._id,
          paymentMethod: order.paymentMethod || 'stripe',
          actorRole: 'system',
        });

        if (!splitResult.success) {
          console.error(
            `[STRIPE WEBHOOK] Failed to create payment split for order ${order.orderId}:`,
            splitResult.error
          );
          // Don't fail the transaction, but log the error
        }

        // STEP 6a: Generate invoices (async, non-blocking)
        const { generateInvoices } = await import('../services/invoiceGenerator.service');
        generateInvoices(order.orderId).catch((error: any) => {
          console.error(`[STRIPE WEBHOOK] Failed to generate invoices for order ${order.orderId}:`, error);
        });

        // STEP 7: Process supplier payouts via Stripe Connect (async, non-blocking)
        processSupplierPayoutsForOrder(order._id, order.storeId.toString()).catch((error: any) => {
          console.error(`[STRIPE WEBHOOK] Failed to process payouts for order ${order.orderId}:`, error);
        });

        // STEP 8: Emit PAYMENT_SUCCESS event
        eventStreamEmitter.emit('event', {
          eventType: 'order.paid',
          payload: {
            orderId: order.orderId,
            storeId: order.storeId.toString(),
            totalAmount: order.totalAmount,
            finalAmount: order.totalAmountWithTax || order.finalAmount || order.totalAmount,
            discountAmount: order.discountAmount || 0,
          },
          storeId: order.storeId.toString(),
          userId: order.customerEmail || undefined,
          occurredAt: new Date(),
        });

        // STEP 9: Audit log
        await logAudit({
          storeId: order.storeId.toString(),
          actorRole: 'system',
          action: 'PAYMENT_SUCCESS',
          entityType: 'PaymentIntent',
          entityId: paymentIntentRecord._id.toString(),
          description: `Payment succeeded for order ${order.orderId}`,
          before: { paymentStatus: 'pending', orderStatus: order.status },
          after: { paymentStatus: 'paid', orderStatus: 'paid' },
          metadata: {
            orderId: order.orderId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            stripeEventId: event.id,
            stripePaymentIntentId: paymentIntent.id,
          },
        });
      }
    }
  });
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  await withTransaction(async (session) => {
    // STEP 1: Find PaymentIntent record
    const paymentIntentRecord = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    }).session(session);

    if (!paymentIntentRecord) {
      throw new Error(`PaymentIntent not found for Stripe PaymentIntent ${paymentIntent.id}`);
    }

    // STEP 2: Check if already processed
    if (paymentIntentRecord.paymentStatus === 'failed') {
      console.log(`[STRIPE WEBHOOK] PaymentIntent ${paymentIntent.id} already marked as failed`);
      return;
    }

    // STEP 3: Update PaymentIntent
    paymentIntentRecord.status = paymentIntent.status;
    paymentIntentRecord.paymentStatus = 'failed';
    paymentIntentRecord.stripeEventId = event.id;
    await paymentIntentRecord.save({ session });

    // STEP 4: Update Order and release inventory
    if (paymentIntentRecord.orderId) {
      const order = await Order.findById(paymentIntentRecord.orderId).session(session);
      if (order) {
        order.status = 'failed';
        await order.save({ session });

        // STEP 5: Release inventory reservation
        const releaseResult = await releaseInventory(order._id, {
          storeId: order.storeId.toString(),
          reason: 'payment_failed',
        });

        if (!releaseResult.success) {
          console.error(
            `[STRIPE WEBHOOK] Failed to release inventory for order ${order.orderId}:`,
            releaseResult.error
          );
        }

        // STEP 6: Emit PAYMENT_FAILED event
        eventStreamEmitter.emit('event', {
          eventType: 'order.payment_failed',
          payload: {
            orderId: order.orderId,
            storeId: order.storeId.toString(),
            reason: paymentIntent.last_payment_error?.message || 'Payment failed',
          },
          storeId: order.storeId.toString(),
          userId: order.customerEmail || undefined,
          occurredAt: new Date(),
        });

        // STEP 7: Audit log
        await logAudit({
          storeId: order.storeId.toString(),
          actorRole: 'system',
          action: 'PAYMENT_FAILED',
          entityType: 'PaymentIntent',
          entityId: paymentIntentRecord._id.toString(),
          description: `Payment failed for order ${order.orderId}`,
          before: { paymentStatus: 'pending', orderStatus: order.status },
          after: { paymentStatus: 'failed', orderStatus: 'failed' },
          metadata: {
            orderId: order.orderId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            stripeEventId: event.id,
            stripePaymentIntentId: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message || 'Unknown error',
          },
        });
      }
    }
  });
}

/**
 * Handle checkout.session.completed event (for subscriptions)
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // This is typically handled by invoice.paid for subscriptions
  // But we can log it for reference
  console.log(`[STRIPE WEBHOOK] Checkout session completed: ${session.id}`);
}

/**
 * Handle invoice.paid event (subscription activated)
 */
async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  if (invoice.subscription) {
    const stripeSubscriptionId = invoice.subscription as string;
    
    // Get subscription from checkout session metadata
    // We need to find subscription by userId and storeId from invoice metadata
    // For now, we'll find by matching the checkout session
    const checkoutSession = await stripe.checkout.sessions.list({
      subscription: stripeSubscriptionId,
      limit: 1,
    });

    if (checkoutSession.data.length > 0) {
      const session = checkoutSession.data[0];
      const userId = session.metadata?.userId;
      const storeId = session.metadata?.storeId;

      if (userId && storeId) {
        const subscription = await Subscription.findOne({
          storeId: new mongoose.Types.ObjectId(storeId),
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ['trial', 'active', 'past_due'] },
        });

        if (subscription) {
          subscription.status = 'active';
          subscription.endDate = new Date(invoice.period_end * 1000);
          await subscription.save();

          // Audit log
          await logAudit({
            storeId: subscription.storeId.toString(),
            actorRole: 'system',
            action: 'SUBSCRIPTION_ACTIVATED',
            entityType: 'Subscription',
            entityId: subscription._id.toString(),
            description: `Subscription activated via Stripe invoice ${invoice.id}`,
            after: { status: 'active', endDate: subscription.endDate },
            metadata: {
              stripeSubscriptionId: stripeSubscriptionId,
              stripeInvoiceId: invoice.id,
              stripeEventId: event.id,
            },
          });
        }
      }
    }
  }
}

/**
 * Handle invoice.payment_failed event (subscription past_due)
 */
async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  if (invoice.subscription) {
    const stripeSubscriptionId = invoice.subscription as string;
    
    // Find subscription via checkout session
    const checkoutSession = await stripe.checkout.sessions.list({
      subscription: stripeSubscriptionId,
      limit: 1,
    });

    if (checkoutSession.data.length > 0) {
      const session = checkoutSession.data[0];
      const userId = session.metadata?.userId;
      const storeId = session.metadata?.storeId;

      if (userId && storeId) {
        const subscription = await Subscription.findOne({
          storeId: new mongoose.Types.ObjectId(storeId),
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ['trial', 'active', 'past_due'] },
        });

        if (subscription) {
          subscription.status = 'past_due';
          await subscription.save();

          // Audit log
          await logAudit({
            storeId: subscription.storeId.toString(),
            actorRole: 'system',
            action: 'SUBSCRIPTION_PAYMENT_FAILED',
            entityType: 'Subscription',
            entityId: subscription._id.toString(),
            description: `Subscription payment failed for invoice ${invoice.id}`,
            after: { status: 'past_due' },
            metadata: {
              stripeSubscriptionId: stripeSubscriptionId,
              stripeInvoiceId: invoice.id,
              stripeEventId: event.id,
            },
          });
        }
      }
    }
  }
}

/**
 * Handle subscription.created or subscription.updated
 */
async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const stripeSubscription = event.data.object as Stripe.Subscription;

  // Find subscription via checkout session
  const checkoutSession = await stripe.checkout.sessions.list({
    subscription: stripeSubscription.id,
    limit: 1,
  });

  if (checkoutSession.data.length > 0) {
    const session = checkoutSession.data[0];
    const userId = session.metadata?.userId;
    const storeId = session.metadata?.storeId;

    if (userId && storeId) {
      const subscription = await Subscription.findOne({
        storeId: new mongoose.Types.ObjectId(storeId),
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ['trial', 'active', 'past_due'] },
      });

      if (subscription) {
        subscription.status = stripeSubscription.status === 'active' ? 'active' : 'past_due';
        subscription.endDate = new Date(stripeSubscription.current_period_end * 1000);
        await subscription.save();
      }
    }
  }
}

/**
 * Handle subscription.deleted
 */
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const stripeSubscription = event.data.object as Stripe.Subscription;

  // Find subscription via checkout session
  const checkoutSession = await stripe.checkout.sessions.list({
    subscription: stripeSubscription.id,
    limit: 1,
  });

  if (checkoutSession.data.length > 0) {
    const session = checkoutSession.data[0];
    const userId = session.metadata?.userId;
    const storeId = session.metadata?.storeId;

    if (userId && storeId) {
      const subscription = await Subscription.findOne({
        storeId: new mongoose.Types.ObjectId(storeId),
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ['trial', 'active', 'past_due'] },
      });

      if (subscription) {
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        await subscription.save();

        // Audit log
        await logAudit({
          storeId: subscription.storeId.toString(),
          actorRole: 'system',
          action: 'SUBSCRIPTION_CANCELLED',
          entityType: 'Subscription',
          entityId: subscription._id.toString(),
          description: `Subscription cancelled via Stripe`,
          after: { status: 'cancelled', cancelledAt: subscription.cancelledAt },
          metadata: {
            stripeSubscriptionId: stripeSubscription.id,
            stripeEventId: event.id,
          },
        });
      }
    }
  }
}

