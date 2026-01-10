import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { stripe } from '../lib/stripe';
import { PaymentIntent } from '../models/PaymentIntent';
import { Order } from '../models/Order';
import { InventoryReservation } from '../models/InventoryReservation';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Stripe Payment Controller
 * 
 * PURPOSE:
 * - Create payment intents for orders
 * - Return clientSecret for frontend
 * - Ensure inventory is reserved before payment
 * - Never mark order paid here (webhook does that)
 */

const createPaymentIntentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * POST /payments/stripe/create-intent
 * Create Stripe PaymentIntent for an order
 */
export const createPaymentIntent = async (
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

    const validatedData = createPaymentIntentSchema.parse(req.body);
    const { orderId } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // STEP 1: Fetch order
    const order = await Order.findOne({
      orderId,
      storeId: storeObjId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // STEP 2: Ensure inventory is already RESERVED
    const reservations = await InventoryReservation.find({
      storeId: storeObjId,
      orderId: order._id,
      status: 'reserved',
    });

    if (reservations.length === 0) {
      sendError(res, 'Inventory must be reserved before creating payment intent', 400);
      return;
    }

    // STEP 3: Check if PaymentIntent already exists
    const existingPaymentIntent = await PaymentIntent.findOne({
      storeId: storeObjId,
      orderId: order._id,
    });

    if (existingPaymentIntent) {
      // Return existing clientSecret
      const stripePaymentIntent = await stripe.paymentIntents.retrieve(
        existingPaymentIntent.stripePaymentIntentId
      );
      sendSuccess(
        res,
        {
          clientSecret: stripePaymentIntent.client_secret,
          paymentIntentId: existingPaymentIntent.stripePaymentIntentId,
        },
        'Payment intent already exists'
      );
      return;
    }

    // STEP 4: Create Stripe PaymentIntent
    const amountInCents = Math.round((order.totalAmountWithTax || order.finalAmount || order.totalAmount) * 100);
    const currency = 'usd'; // TODO: Make configurable

    const stripePaymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      metadata: {
        orderId: order.orderId,
        storeId: storeId,
        userId: currentUser.id,
      },
      description: `Order ${order.orderId}`,
      // Don't auto-confirm, let frontend handle confirmation
      confirmation_method: 'manual',
      confirm: false,
    });

    // STEP 5: Save PaymentIntent record
    const paymentIntent = new PaymentIntent({
      storeId: storeObjId,
      orderId: order._id,
      stripePaymentIntentId: stripePaymentIntent.id,
      amount: amountInCents,
      currency: currency,
      status: stripePaymentIntent.status,
      paymentStatus: 'pending',
      metadata: {
        orderId: order.orderId,
        userId: currentUser.id,
      },
    });

    await paymentIntent.save();

    // Update order with paymentIntentId
    order.paymentIntentId = stripePaymentIntent.id;
    await order.save();

    // STEP 6: Audit log
    await logAudit({
      req,
      action: 'PAYMENT_INTENT_CREATED',
      entityType: 'PaymentIntent',
      entityId: paymentIntent._id.toString(),
      description: `Payment intent created for order ${order.orderId}`,
      after: {
        orderId: order.orderId,
        amount: amountInCents,
        currency: currency,
        stripePaymentIntentId: stripePaymentIntent.id,
      },
      metadata: {
        storeId: storeId,
        userId: currentUser.id,
      },
    });

    // STEP 7: Return clientSecret
    sendSuccess(
      res,
      {
        clientSecret: stripePaymentIntent.client_secret,
        paymentIntentId: stripePaymentIntent.id,
      },
      'Payment intent created successfully',
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

/**
 * GET /payments/stripe/intent/:paymentIntentId
 * Get payment intent status
 */
export const getPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { paymentIntentId } = req.params;

    if (!storeId) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const paymentIntent = await PaymentIntent.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      stripePaymentIntentId: paymentIntentId,
    }).populate('orderId', 'orderId status');

    if (!paymentIntent) {
      sendError(res, 'Payment intent not found', 404);
      return;
    }

    // Get latest status from Stripe
    const stripePaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    sendSuccess(
      res,
      {
        paymentIntent: {
          id: paymentIntent._id,
          stripePaymentIntentId: paymentIntent.stripePaymentIntentId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: stripePaymentIntent.status,
          paymentStatus: paymentIntent.paymentStatus,
          orderId: paymentIntent.orderId,
        },
      },
      'Payment intent fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

