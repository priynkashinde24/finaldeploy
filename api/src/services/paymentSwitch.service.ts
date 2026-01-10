import { getPaymentProvider } from '../payments/paymentProvider';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { PaymentIntent } from '../models/PaymentIntent';
import { checkCODEligibility } from '../utils/codEligibility';
import mongoose from 'mongoose';

/**
 * Unified Payment Switch Service
 * 
 * PURPOSE:
 * - Provide single interface to switch between payment methods
 * - Validate payment method eligibility
 * - Create appropriate payment sessions
 * - Handle payment method changes
 */

export interface PaymentMethodOption {
  method: 'stripe' | 'paypal' | 'cod' | 'cod_partial';
  available: boolean;
  reason?: string;
  metadata?: {
    codLimit?: number;
    requiresPrepaid?: boolean;
  };
}

export interface SwitchPaymentMethodParams {
  orderId: string;
  storeId: mongoose.Types.ObjectId | string;
  newPaymentMethod: 'stripe' | 'paypal' | 'cod' | 'cod_partial';
  prepaidAmount?: number; // For cod_partial
  customerEmail: string;
  customerName: string;
  shippingAddress?: {
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface SwitchPaymentMethodResult {
  success: boolean;
  paymentSession?: {
    providerOrderId?: string;
    clientSecret?: string;
    approvalUrl?: string;
    provider: string;
  };
  error?: string;
}

/**
 * Get available payment methods for an order
 */
export async function getAvailablePaymentMethods(
  orderId: string,
  storeId: mongoose.Types.ObjectId | string,
  customerEmail: string,
  orderAmount: number,
  shippingAddress?: {
    city: string;
    state: string;
    zip: string;
    country: string;
  }
): Promise<PaymentMethodOption[]> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const options: PaymentMethodOption[] = [
    {
      method: 'stripe',
      available: !!process.env.STRIPE_SECRET_KEY,
      metadata: {},
    },
    {
      method: 'paypal',
      available: !!process.env.PAYPAL_CLIENT_ID,
      metadata: {},
    },
  ];

  // Check COD eligibility
  const codEligibility = await checkCODEligibility({
    storeId: storeObjId,
    userId: customerEmail,
    orderAmount: orderAmount * 100, // Convert to cents
    items: [], // Would need actual items
    shippingAddress,
  });

  options.push({
    method: 'cod',
    available: codEligibility.allowed,
    reason: codEligibility.reason,
    metadata: {
      codLimit: codEligibility.codLimit ? codEligibility.codLimit / 100 : undefined,
    },
  });

  // COD partial prepaid is available if COD is available and order amount > COD limit
  const codLimit = codEligibility.codLimit ? codEligibility.codLimit / 100 : 0;
  const codPartialAvailable = codEligibility.allowed && orderAmount > codLimit;

  options.push({
    method: 'cod_partial',
    available: codPartialAvailable,
    reason: codPartialAvailable
      ? undefined
      : codEligibility.allowed
        ? 'Order amount is within COD limit'
        : codEligibility.reason,
    metadata: {
      codLimit: codLimit,
      requiresPrepaid: true,
    },
  });

  return options;
}

/**
 * Switch payment method for an order
 */
export async function switchPaymentMethod(
  params: SwitchPaymentMethodParams
): Promise<SwitchPaymentMethodResult> {
  try {
    const storeObjId =
      typeof params.storeId === 'string' ? new mongoose.Types.ObjectId(params.storeId) : params.storeId;

    // Get order
    const order = await Order.findOne({
      orderId: params.orderId,
      storeId: storeObjId,
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Check if order can be modified
    if (order.status !== 'pending' || (order.paymentStatus && order.paymentStatus !== 'pending')) {
      return { success: false, error: 'Order payment cannot be changed at this stage' };
    }

    // Handle different payment method switches
    if (params.newPaymentMethod === 'stripe' || params.newPaymentMethod === 'paypal') {
      // Online payment
      const paymentProvider = getPaymentProvider(params.newPaymentMethod);
      const totalAmount = order.totalAmountWithTax || order.totalAmount;

      const paymentSession = await paymentProvider.createOrderPayment({
        orderId: order.orderId,
        amount: Math.round(totalAmount * 100),
        currency: 'USD',
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        storeName: 'Store', // Would need store name
        metadata: {
          orderId: order.orderId,
        },
      });

      // Update order
      order.paymentMethod = params.newPaymentMethod;
      order.paymentStatus = 'pending';
      await order.save();

      return {
        success: true,
        paymentSession: {
          providerOrderId: paymentSession.providerOrderId,
          clientSecret: paymentSession.clientSecret,
          approvalUrl: paymentSession.approvalUrl,
          provider: params.newPaymentMethod,
        },
      };
    } else if (params.newPaymentMethod === 'cod') {
      // COD
      const totalAmount = order.totalAmountWithTax || order.totalAmount;
      const codEligibility = await checkCODEligibility({
        storeId: storeObjId,
        userId: params.customerEmail,
        orderAmount: totalAmount * 100,
        items: [],
        shippingAddress: params.shippingAddress,
      });

      if (!codEligibility.allowed) {
        return { success: false, error: codEligibility.reason || 'COD not available' };
      }

      order.paymentMethod = 'cod';
      order.paymentStatus = 'cod_pending';
      order.codAmount = totalAmount;
      order.prepaidAmount = undefined;
      await order.save();

      return { success: true };
    } else if (params.newPaymentMethod === 'cod_partial') {
      // COD partial prepaid
      if (!params.prepaidAmount) {
        return { success: false, error: 'Prepaid amount is required for partial COD' };
      }

      const totalAmount = order.totalAmountWithTax || order.totalAmount;
      const codAmount = totalAmount - params.prepaidAmount;

      if (codAmount <= 0) {
        return { success: false, error: 'Prepaid amount must be less than total amount' };
      }

      const codEligibility = await checkCODEligibility({
        storeId: storeObjId,
        userId: params.customerEmail,
        orderAmount: codAmount * 100,
        items: [],
        shippingAddress: params.shippingAddress,
      });

      if (!codEligibility.allowed) {
        return { success: false, error: codEligibility.reason || 'COD not available for remaining amount' };
      }

      // Create payment intent for prepaid amount (default to Stripe)
      const paymentProvider = getPaymentProvider('stripe');
      const paymentSession = await paymentProvider.createOrderPayment({
        orderId: order.orderId,
        amount: Math.round(params.prepaidAmount * 100),
        currency: 'USD',
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        storeName: 'Store',
        metadata: {
          orderId: order.orderId,
          paymentType: 'partial_prepaid',
          codAmount,
        },
      });

      order.paymentMethod = 'cod_partial';
      order.paymentStatus = 'cod_partial_paid';
      order.codAmount = codAmount;
      order.prepaidAmount = params.prepaidAmount;
      await order.save();

      return {
        success: true,
        paymentSession: {
          providerOrderId: paymentSession.providerOrderId,
          clientSecret: paymentSession.clientSecret,
          provider: 'stripe',
        },
      };
    }

    return { success: false, error: 'Invalid payment method' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to switch payment method' };
  }
}

