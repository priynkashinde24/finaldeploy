import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import {
  getAvailablePaymentMethods as getAvailablePaymentMethodsService,
  switchPaymentMethod as switchPaymentMethodService,
} from '../services/paymentSwitch.service';
import { Order } from '../models/Order';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Payment Switch Controller
 * 
 * PURPOSE:
 * - Get available payment methods for an order
 * - Switch payment method for an order
 */

const switchPaymentMethodSchema = z.object({
  orderId: z.string().min(1),
  newPaymentMethod: z.enum(['stripe', 'paypal', 'cod', 'cod_partial']),
  prepaidAmount: z.number().optional(),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  shippingAddress: z
    .object({
      city: z.string().min(1),
      state: z.string().min(1),
      zip: z.string().min(1),
      country: z.string().min(1),
    })
    .optional(),
});

/**
 * GET /payments/switch/methods/:orderId
 * Get available payment methods for an order
 */
export const getAvailablePaymentMethods = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { orderId } = req.params;

    if (!storeId) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const order = await Order.findOne({
      orderId,
      storeId: new mongoose.Types.ObjectId(storeId),
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    const orderAmount = order.totalAmountWithTax || order.totalAmount;
    const methods = await getAvailablePaymentMethodsService(
      orderId,
      storeId,
      order.customerEmail || '',
      orderAmount,
      order.shippingAddress
    );

    sendSuccess(res, { methods }, 'Available payment methods retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /payments/switch/switch
 * Switch payment method for an order
 */
export const switchPaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const validatedData = switchPaymentMethodSchema.parse(req.body);

    if (!storeId) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const result = await switchPaymentMethodService({
      ...validatedData,
      storeId,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to switch payment method', 400);
      return;
    }

    sendSuccess(
      res,
      {
        paymentSession: result.paymentSession,
        message: 'Payment method switched successfully',
      },
      'Payment method switched successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

