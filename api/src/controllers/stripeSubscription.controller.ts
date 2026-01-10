import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { stripe } from '../lib/stripe';
import { Subscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Stripe Subscription Controller
 * 
 * PURPOSE:
 * - Create Stripe subscriptions
 * - Handle subscription checkout
 * - Link subscriptions to Stripe
 */

const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['monthly', 'yearly']),
});

/**
 * POST /subscriptions/stripe/create
 * Create Stripe subscription checkout session
 */
export const createStripeSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = createSubscriptionSchema.parse(req.body);
    const { planId, billingCycle } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const planObjId = new mongoose.Types.ObjectId(planId);

    // STEP 1: Fetch plan
    const plan = await Plan.findById(planObjId);
    if (!plan) {
      sendError(res, 'Plan not found', 404);
      return;
    }

    // STEP 2: Calculate amount
    const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    const amountInCents = Math.round(amount * 100);

    // STEP 3: Create or retrieve Stripe customer
    let customerId: string;
    const customers = await stripe.customers.list({
      email: currentUser.email || '',
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: currentUser.email || undefined,
        name: currentUser.name || undefined,
        metadata: {
          userId: currentUser.id,
          storeId: storeId,
        },
      });
      customerId = customer.id;
    }

    // STEP 4: Create Stripe checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.description || `${billingCycle} subscription`,
            },
            unit_amount: amountInCents,
            recurring: {
              interval: billingCycle === 'yearly' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancel`,
      metadata: {
        userId: currentUser.id,
        storeId: storeId,
        planId: planId,
        billingCycle: billingCycle,
      },
    });

    // STEP 5: Create or update subscription record (pending activation)
    const subscription = await Subscription.findOneAndUpdate(
      {
        storeId: storeObjId,
        userId: new mongoose.Types.ObjectId(currentUser.id),
        status: { $in: ['trial', 'active', 'past_due'] },
      },
      {
        $set: {
          storeId: storeObjId,
          userId: new mongoose.Types.ObjectId(currentUser.id),
          role: currentUser.role === 'reseller' ? 'reseller' : 'supplier',
          planId: planObjId,
          billingCycle: billingCycle,
          status: 'trial', // Will be updated to 'active' on webhook
          startDate: new Date(),
          endDate: new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
          metadata: {
            stripeCustomerId: customerId,
            stripeCheckoutSessionId: session.id,
            pending: true,
          },
        },
      },
      { upsert: true, new: true }
    );

    // STEP 6: Audit log
    await logAudit({
      req,
      action: 'SUBSCRIPTION_CHECKOUT_CREATED',
      entityType: 'Subscription',
      entityId: subscription._id.toString(),
      description: `Subscription checkout created for plan ${plan.name}`,
      after: {
        planId: planId,
        billingCycle: billingCycle,
        amount: amount,
        stripeCheckoutSessionId: session.id,
      },
      metadata: {
        storeId: storeId,
        userId: currentUser.id,
      },
    });

    // STEP 7: Return checkout URL
    sendSuccess(
      res,
      {
        checkoutUrl: session.url,
        sessionId: session.id,
        subscriptionId: subscription._id.toString(),
      },
      'Subscription checkout created successfully',
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

