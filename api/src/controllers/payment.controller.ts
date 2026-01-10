import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { BillingInvoice } from '../models/BillingInvoice';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { getPaymentProvider } from '../payments/paymentProvider';
import { z } from 'zod';

/**
 * Payment Controller
 * 
 * PURPOSE:
 * - Handle subscription payments
 * - Support plan upgrades
 * - Generate invoices
 * - Update subscription state safely
 */

// Validation schemas
const subscribeSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['monthly', 'yearly']),
  provider: z.enum(['razorpay', 'stripe']),
});

const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  orderId: z.string().optional(),
  signature: z.string().optional(), // For Razorpay
  sessionId: z.string().optional(), // For Stripe
  provider: z.enum(['razorpay', 'stripe']),
});

/**
 * POST /payments/subscribe
 * Create payment session for subscription
 */
export const createSubscriptionPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Validate request body
    const validatedData = subscribeSchema.parse(req.body);
    const { planId, billingCycle, provider } = validatedData;

    // Get plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      sendError(res, 'Plan not found', 404);
      return;
    }

    if (plan.status !== 'active') {
      sendError(res, 'Plan is not active', 400);
      return;
    }

    // Check if user already has active subscription
    const existingSubscription = await Subscription.findOne({
      userId: new mongoose.Types.ObjectId(currentUser.id),
      status: { $in: ['trial', 'active', 'past_due'] },
    });

    if (existingSubscription) {
      sendError(
        res,
        'You already have an active subscription. Please cancel it first or contact admin for upgrade.',
        400
      );
      return;
    }

    // Calculate amount based on billing cycle
    const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    const currency = provider === 'razorpay' ? 'INR' : 'USD';
    const amountInSmallestUnit = provider === 'razorpay' ? amount * 100 : amount * 100; // Paise or cents

    // Get payment provider
    const paymentProvider = getPaymentProvider(provider);

    // Create payment session
    const paymentSession = await paymentProvider.createSubscription({
      userId: currentUser.id,
      planId: planId,
      billingCycle,
      amount: amountInSmallestUnit,
      currency,
      customerEmail: currentUser.email || '',
      customerName: currentUser.name ?? '',
      metadata: {
        userId: currentUser.id,
        planId: planId,
        role: currentUser.role,
      },
    });

    // Create subscription record (pending payment)
    const subscription = new Subscription({
      userId: new mongoose.Types.ObjectId(currentUser.id),
      role: currentUser.role as 'reseller' | 'supplier',
      planId: plan._id,
      billingCycle,
      startDate: new Date(),
      endDate: new Date(), // Will be updated on payment success
      status: 'trial', // Will be updated to 'active' on payment success
      usage: {
        productsUsed: 0,
        variantsUsed: 0,
        ordersThisMonth: 0,
        lastResetDate: new Date(),
      },
    });

    await subscription.save();

    sendSuccess(
      res,
      {
        paymentSession,
        subscriptionId: subscription._id.toString(),
      },
      'Payment session created successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * POST /payments/verify
 * Verify payment and activate subscription
 */
export const verifyPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Validate request body
    const validatedData = verifyPaymentSchema.parse(req.body);
    const { paymentId, orderId, signature, sessionId, provider } = validatedData;

    // Get payment provider
    const paymentProvider = getPaymentProvider(provider);

    // Verify payment
    const isValid = await paymentProvider.verifyPayment({
      paymentId,
      orderId,
      signature,
      event: sessionId ? { id: sessionId } : undefined,
    });

    if (!isValid) {
      sendError(res, 'Payment verification failed', 400);
      return;
    }

    // Find user's pending subscription
    const subscription = await Subscription.findOne({
      userId: new mongoose.Types.ObjectId(currentUser.id),
      status: { $in: ['trial', 'past_due'] },
    })
      .populate('planId')
      .lean();

    if (!subscription) {
      sendError(res, 'No pending subscription found', 404);
      return;
    }

    const plan = subscription.planId as any;

    // Calculate end date based on billing cycle
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (subscription.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Update subscription
    await Subscription.findByIdAndUpdate(subscription._id, {
      status: 'active',
      startDate,
      endDate,
    });

    // Create invoice
    const invoice = new BillingInvoice({
      userId: new mongoose.Types.ObjectId(currentUser.id),
      subscriptionId: subscription._id,
      amount: subscription.billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly,
      billingPeriod: {
        start: startDate,
        end: endDate,
      },
      status: 'paid',
      paidAt: new Date(),
      paymentMethod: provider,
      paymentTransactionId: paymentId,
    });

    await invoice.save();

    sendSuccess(
      res,
      {
        subscription: {
          ...subscription,
          status: 'active',
          startDate,
          endDate,
        },
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          status: invoice.status,
        },
      },
      'Payment verified and subscription activated successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

