import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { PaymentIntent } from '../models/PaymentIntent';
import { getPaymentProvider } from '../payments/paymentProvider';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Payment Recovery Controller
 * 
 * PURPOSE:
 * - Retry failed payments
 * - Get payment status
 * - Handle payment recovery UX
 */

const retryPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  provider: z.enum(['stripe', 'paypal']).optional(), // Auto-detect if not provided
});

const getPaymentStatusSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * POST /payments/recovery/retry
 * Retry a failed payment
 */
export const retryPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = retryPaymentSchema.parse(req.body);
    const { orderId, provider } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Get order
    const order = await Order.findOne({
      orderId,
      storeId: storeObjId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Check if order is in a state that can be retried
    if (order.status !== 'pending' && order.status !== 'failed') {
      sendError(res, `Order status is ${order.status}, cannot retry payment`, 400);
      return;
    }

    // Determine provider
    let paymentProvider: 'stripe' | 'paypal' | null = provider || null;

    if (!paymentProvider) {
      // Try to find existing payment record
      const existingPayment = await Payment.findOne({
        storeId: storeObjId,
        orderId: order._id,
      });

      if (existingPayment) {
        paymentProvider = existingPayment.provider as 'stripe' | 'paypal';
      } else {
        // Default to Stripe if no preference
        paymentProvider = 'stripe';
      }
    }

    // Create new payment based on provider
    if (paymentProvider === 'stripe') {
      // Check for existing PaymentIntent
      const existingPaymentIntent = await PaymentIntent.findOne({
        storeId: storeObjId,
        orderId: order._id,
      });

      if (existingPaymentIntent && existingPaymentIntent.paymentStatus === 'failed') {
        // Create new PaymentIntent for retry
        const stripeProvider = getPaymentProvider('stripe');
        const paymentSession = await stripeProvider.createOrderPayment({
          orderId: order.orderId,
          amount: Math.round((order.totalAmountWithTax || order.totalAmount) * 100),
          currency: 'USD', // Default currency
          customerEmail: order.customerEmail || '',
          customerName: order.customerName || 'Customer',
          storeName: req.store?.store.name || 'Store',
        });

        // Update or create PaymentIntent record
        if (existingPaymentIntent) {
          existingPaymentIntent.stripePaymentIntentId = paymentSession.providerOrderId;
          existingPaymentIntent.paymentStatus = 'pending';
          await existingPaymentIntent.save();
        } else {
          const newPaymentIntent = new PaymentIntent({
            storeId: storeObjId,
            orderId: order._id,
            stripePaymentIntentId: paymentSession.providerOrderId,
            amount: Math.round((order.totalAmountWithTax || order.totalAmount) * 100),
            currency: 'USD', // Default currency
            paymentStatus: 'pending',
          });
          await newPaymentIntent.save();
        }

        await logAudit({
          req,
          action: 'PAYMENT_RETRY_INITIATED',
          entityType: 'Order',
          entityId: order._id.toString(),
          description: `Payment retry initiated for order ${order.orderId}`,
          metadata: {
            orderId: order.orderId,
            provider: 'stripe',
            paymentIntentId: paymentSession.providerOrderId,
          },
        });

        sendSuccess(
          res,
          {
            clientSecret: paymentSession.clientSecret,
            paymentIntentId: paymentSession.providerOrderId,
            provider: 'stripe',
          },
          'Payment retry initiated successfully'
        );
        return;
      }
    } else if (paymentProvider === 'paypal') {
      // Check for existing Payment
      const existingPayment = await Payment.findOne({
        storeId: storeObjId,
        orderId: order._id,
        provider: 'paypal',
      });

      if (existingPayment && existingPayment.status === 'failed') {
        // Create new PayPal order for retry
        const paypalProvider = getPaymentProvider('paypal');
        const paymentSession = await paypalProvider.createOrderPayment({
          orderId: order.orderId,
          amount: Math.round((order.totalAmountWithTax || order.totalAmount) * 100),
          currency: 'USD', // Default currency
          customerEmail: order.customerEmail || '',
          customerName: order.customerName || 'Customer',
          storeName: req.store?.store.name || 'Store',
        });

        // Update Payment record
        existingPayment.providerOrderId = paymentSession.providerOrderId;
        existingPayment.status = 'created';
        await existingPayment.save();

        await logAudit({
          req,
          action: 'PAYMENT_RETRY_INITIATED',
          entityType: 'Order',
          entityId: order._id.toString(),
          description: `Payment retry initiated for order ${order.orderId}`,
          metadata: {
            orderId: order.orderId,
            provider: 'paypal',
            paypalOrderId: paymentSession.providerOrderId,
          },
        });

        sendSuccess(
          res,
          {
            approvalUrl: paymentSession.approvalUrl,
            paypalOrderId: paymentSession.providerOrderId,
            provider: 'paypal',
          },
          'Payment retry initiated successfully'
        );
        return;
      }
    }

    sendError(res, 'No failed payment found to retry', 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /payments/recovery/status/:orderId
 * Get payment status for an order
 */
export const getPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { orderId } = req.params;

    if (!storeId) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Get order
    const order = await Order.findOne({
      orderId,
      storeId: storeObjId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Get payment records
    const payment = await Payment.findOne({
      storeId: storeObjId,
      orderId: order._id,
    });

    const paymentIntent = await PaymentIntent.findOne({
      storeId: storeObjId,
      orderId: order._id,
    });

    // Determine payment status from payment records
    const paymentStatusValue = payment?.status === 'paid' ? 'paid' : 
                               payment?.status === 'failed' ? 'failed' : 
                               paymentIntent?.paymentStatus === 'paid' ? 'paid' :
                               paymentIntent?.paymentStatus === 'failed' ? 'failed' : 'pending';

    const paymentStatus = {
      orderId: order.orderId,
      orderStatus: order.status,
      paymentStatus: paymentStatusValue,
      provider: payment?.provider || (paymentIntent ? 'stripe' : null),
      canRetry: order.status === 'pending' || order.status === 'failed',
      payment: payment
        ? {
            provider: payment.provider,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            providerOrderId: payment.providerOrderId,
          }
        : null,
      paymentIntent: paymentIntent
        ? {
            paymentIntentId: paymentIntent.stripePaymentIntentId,
            status: paymentIntent.paymentStatus,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          }
        : null,
    };

    sendSuccess(res, paymentStatus, 'Payment status retrieved successfully');
  } catch (error) {
    next(error);
  }
};

