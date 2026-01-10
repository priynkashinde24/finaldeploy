import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { paypalClient } from '../lib/paypal';
import paypal from '@paypal/checkout-server-sdk';
import { Payment } from '../models/Payment';
import { Order } from '../models/Order';
import { InventoryReservation } from '../models/InventoryReservation';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * PayPal Payment Controller
 * 
 * PURPOSE:
 * - Create PayPal orders for payment
 * - Return approval URL for frontend
 * - Ensure inventory is reserved before payment
 * - Never mark order paid here (webhook does that)
 */

const createPayPalOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * POST /payments/paypal/create-order
 * Create PayPal order for payment
 */
export const createPayPalOrder = async (
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

    const validatedData = createPayPalOrderSchema.parse(req.body);
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
      sendError(res, 'Inventory must be reserved before creating PayPal order', 400);
      return;
    }

    // STEP 3: Check if Payment already exists
    const existingPayment = await Payment.findOne({
      storeId: storeObjId,
      orderId: order._id,
      provider: 'paypal',
    });

    if (existingPayment) {
      // Return existing approval URL if order is still pending
      if (existingPayment.status === 'created' || existingPayment.status === 'approved') {
        // Get PayPal order to get approval URL
        try {
          const request = new paypal.orders.OrdersGetRequest(existingPayment.providerOrderId);
          const paypalOrder = await paypalClient.execute(request);

          if (paypalOrder.result.status === 'CREATED' || paypalOrder.result.status === 'APPROVED') {
            const approvalUrl = paypalOrder.result.links?.find((link: any) => link.rel === 'approve')?.href;
            sendSuccess(
              res,
              {
                paypalOrderId: existingPayment.providerOrderId,
                approvalUrl: approvalUrl,
                status: existingPayment.status,
              },
              'PayPal order already exists'
            );
            return;
          }
        } catch (error: any) {
          // If PayPal order not found, create new one
          console.error('[PAYPAL] Error fetching existing order:', error);
        }
      } else {
        sendError(res, `Payment already ${existingPayment.status}`, 400);
        return;
      }
    }

    // STEP 4: Create PayPal order
    const amount = Math.round((order.totalAmountWithTax || order.finalAmount || order.totalAmount) * 100); // Convert to cents
    const currency = 'USD'; // TODO: Make configurable

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order.orderId,
          description: `Order ${order.orderId}`,
          custom_id: order.orderId,
          amount: {
            currency_code: currency,
            value: (amount / 100).toFixed(2), // PayPal expects string with 2 decimal places
          },
        },
      ],
      application_context: {
        brand_name: 'Your Store', // TODO: Get from store settings
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/paypal/success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/paypal/cancel`,
      },
    });

    const paypalOrder = await paypalClient.execute(request);

    if (paypalOrder.statusCode !== 201) {
      sendError(res, 'Failed to create PayPal order', 500);
      return;
    }

    const orderData = paypalOrder.result;
    const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      sendError(res, 'Failed to get PayPal approval URL', 500);
      return;
    }

    // STEP 5: Save Payment record
    const payment = new Payment({
      storeId: storeObjId,
      orderId: order._id,
      provider: 'paypal',
      providerOrderId: orderData.id!,
      amount: amount,
      currency: currency,
      status: 'created',
      paymentStatus: 'pending',
      metadata: {
        orderId: order.orderId,
        userId: currentUser.id,
        paypalOrderStatus: orderData.status,
      },
    });

    await payment.save();

    // Update order with payment ID
    order.paymentIntentId = orderData.id; // Reusing paymentIntentId field for PayPal order ID
    await order.save();

    // STEP 6: Audit log
    await logAudit({
      req,
      action: 'PAYPAL_ORDER_CREATED',
      entityType: 'Payment',
      entityId: payment._id.toString(),
      description: `PayPal order created for order ${order.orderId}`,
      after: {
        orderId: order.orderId,
        amount: amount,
        currency: currency,
        paypalOrderId: orderData.id,
      },
      metadata: {
        storeId: storeId,
        userId: currentUser.id,
      },
    });

    // STEP 7: Return approval URL
    sendSuccess(
      res,
      {
        paypalOrderId: orderData.id,
        approvalUrl: approvalUrl,
        status: 'created',
      },
      'PayPal order created successfully',
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
 * GET /payments/paypal/order/:paypalOrderId
 * Get PayPal order status
 */
export const getPayPalOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { paypalOrderId } = req.params;

    if (!storeId) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const payment = await Payment.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      provider: 'paypal',
      providerOrderId: paypalOrderId,
    }).populate('orderId', 'orderId status');

    if (!payment) {
      sendError(res, 'Payment not found', 404);
      return;
    }

    // Get latest status from PayPal
    try {
      const request = new paypal.orders.OrdersGetRequest(paypalOrderId);
      const paypalOrder = await paypalClient.execute(request);

      sendSuccess(
        res,
        {
          payment: {
            id: payment._id,
            paypalOrderId: payment.providerOrderId,
            amount: payment.amount,
            currency: payment.currency,
            status: paypalOrder.result.status,
            paymentStatus: payment.paymentStatus,
            orderId: payment.orderId,
          },
        },
        'PayPal order fetched successfully'
      );
    } catch (error: any) {
      sendError(res, `Failed to fetch PayPal order: ${error.message}`, 500);
    }
  } catch (error) {
    next(error);
  }
};

