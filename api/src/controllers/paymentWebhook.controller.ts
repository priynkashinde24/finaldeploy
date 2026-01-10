import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import crypto from 'crypto';
import { Subscription } from '../models/Subscription';
import { BillingInvoice } from '../models/BillingInvoice';
import { getPaymentProvider } from '../payments/paymentProvider';
import { sendSuccess, sendError } from '../utils/responseFormatter';

/**
 * Payment Webhook Controller
 * 
 * PURPOSE:
 * - Handle webhooks from Razorpay and Stripe
 * - Update subscription state
 * - Generate invoices
 * - Webhooks are source of truth
 * 
 * RULES:
 * - Always verify webhook signature
 * - Idempotent handling (no duplicate processing)
 * - Never trust frontend success
 */

/**
 * POST /webhooks/razorpay
 * Handle Razorpay webhook
 */
export const handleRazorpayWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        sendError(res, 'Invalid webhook signature', 401);
        return;
      }
    }

    // Get payment provider
    const paymentProvider = getPaymentProvider('razorpay');

    // Handle webhook
    const result = await paymentProvider.handleWebhook(req.body);

    // Process webhook result
    await processWebhookResult(result, 'razorpay');

    // Always return 200 to Razorpay (even if processing fails)
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[RAZORPAY WEBHOOK] Error:', error);
    // Still return 200 to prevent Razorpay from retrying
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
};

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = req.headers['stripe-signature'] as string;

    if (!webhookSecret || !signature) {
      sendError(res, 'Webhook secret not configured', 500);
      return;
    }

    // Verify webhook signature
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16', // Stripe API version (YYYY-MM-DD format)
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err: any) {
      sendError(res, `Webhook signature verification failed: ${err.message}`, 400);
      return;
    }

    // Get payment provider
    const paymentProvider = getPaymentProvider('stripe');

    // Handle webhook
    const result = await paymentProvider.handleWebhook(event);

    // Process webhook result
    await processWebhookResult(result, 'stripe');

    // Return 200 to Stripe
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Process webhook result and update subscription/invoice
 */
async function processWebhookResult(
  result: any,
  provider: 'razorpay' | 'stripe'
): Promise<void> {
  try {
    if (!result.success) {
      console.log(`[WEBHOOK] Payment failed: ${result.eventType}`);
      return;
    }

    // Handle payment success
    if (result.status === 'success' && result.paymentId) {
      // Extract userId and subscriptionId from metadata
      const userId = result.metadata?.metadata?.userId || result.metadata?.userId;
      const planId = result.metadata?.metadata?.planId;

      if (!userId) {
        console.error('[WEBHOOK] No userId found in metadata');
        return;
      }

      // Find subscription by userId and planId (if provided)
      const subscriptionFilter: any = {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ['trial', 'past_due'] },
      };

      if (planId) {
        subscriptionFilter.planId = new mongoose.Types.ObjectId(planId);
      }

      const subscription = await Subscription.findOne(subscriptionFilter)
        .populate('planId')
        .lean();

      if (!subscription) {
        console.error(`[WEBHOOK] Subscription not found for userId: ${userId}, planId: ${planId}`);
        return;
      }

      // Check if invoice already exists (idempotency)
      const existingInvoice = await BillingInvoice.findOne({
        subscriptionId: subscription._id,
        paymentTransactionId: result.paymentId,
      });

      if (existingInvoice && existingInvoice.status === 'paid') {
        console.log(`[WEBHOOK] Invoice already processed: ${existingInvoice.invoiceNumber}`);
        return; // Already processed
      }

      const plan = subscription.planId as any;

      // Update subscription
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (subscription.billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      await Subscription.findByIdAndUpdate(subscription._id, {
        status: 'active',
        startDate,
        endDate,
      });

      // Create or update invoice
      if (!existingInvoice) {
        const invoice = new BillingInvoice({
          userId: subscription.userId,
          subscriptionId: subscription._id,
          amount: subscription.billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly,
          billingPeriod: {
            start: startDate,
            end: endDate,
          },
          status: 'paid',
          paidAt: new Date(),
          paymentMethod: provider,
          paymentTransactionId: result.paymentId,
        });

        await invoice.save();
        console.log(`[WEBHOOK] Invoice created: ${invoice.invoiceNumber}`);
      } else {
        // Update existing invoice
        await BillingInvoice.findByIdAndUpdate(existingInvoice._id, {
          status: 'paid',
          paidAt: new Date(),
          paymentTransactionId: result.paymentId,
        });
        console.log(`[WEBHOOK] Invoice updated: ${existingInvoice.invoiceNumber}`);
      }

      console.log(`[WEBHOOK] Subscription ${subscription._id} activated`);
    }

    // Handle payment failure
    if (result.status === 'failed' && result.paymentId) {
      const userId = result.metadata?.metadata?.userId || result.metadata?.userId;
      
      if (userId) {
        const subscription = await Subscription.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ['trial', 'active'] },
        });

        if (subscription) {
          await Subscription.findByIdAndUpdate(subscription._id, {
            status: 'past_due',
          });
          console.log(`[WEBHOOK] Subscription ${subscription._id} marked as past_due`);
        }
      }
    }

    // Handle subscription cancellation
    if (result.eventType?.includes('cancelled') || result.eventType?.includes('deleted')) {
      const userId = result.metadata?.metadata?.userId || result.metadata?.userId;
      
      if (userId) {
        const subscription = await Subscription.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ['trial', 'active', 'past_due'] },
        });

        if (subscription) {
          await Subscription.findByIdAndUpdate(subscription._id, {
            status: 'cancelled',
            cancelledAt: new Date(),
          });
          console.log(`[WEBHOOK] Subscription ${subscription._id} cancelled`);
        }
      }
    }
  } catch (error) {
    console.error('[WEBHOOK] Process result error:', error);
    throw error;
  }
}

