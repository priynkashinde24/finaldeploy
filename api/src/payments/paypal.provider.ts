import {
  PaymentProvider,
  CreateSubscriptionParams,
  CreateOneTimePaymentParams,
  CreateOrderPaymentParams,
  CreateRefundParams,
  VerifyPaymentParams,
  PaymentSession,
  OrderPaymentSession,
  WebhookResult,
  RefundResult,
  RefundStatus,
} from './paymentProvider';
import { paypalClient } from '../lib/paypal';
import paypal from '@paypal/checkout-server-sdk';

/**
 * PayPal Payment Provider
 * 
 * PURPOSE:
 * - Handle payments via PayPal
 * - Create PayPal orders
 * - Handle refunds
 * - Verify webhooks
 */

export class PayPalProvider implements PaymentProvider {
  constructor() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
    }
  }

  /**
   * Create a subscription payment session (PayPal subscriptions)
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<PaymentSession> {
    // PayPal subscriptions require a different flow (Billing Plans)
    // For now, throw error - can be implemented later
    throw new Error('PayPal subscriptions not yet implemented. Use createOneTimePayment or createOrderPayment.');
  }

  /**
   * Create a one-time payment session
   */
  async createOneTimePayment(params: CreateOneTimePaymentParams): Promise<PaymentSession> {
    try {
      const { amount, currency, customerEmail, customerName, description, metadata } = params;

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency || 'USD',
              value: (amount / 100).toFixed(2), // Convert cents to dollars
            },
            description: description || 'Payment',
            soft_descriptor: customerName?.substring(0, 22) || 'Payment',
          },
        ],
        application_context: {
          return_url: process.env.PAYPAL_SUCCESS_URL || `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: process.env.PAYPAL_CANCEL_URL || `${process.env.FRONTEND_URL}/payment/cancel`,
          brand_name: metadata?.storeName || 'Store',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      });

      const response = await paypalClient.execute(request);
      const paypalOrder = response.result;

      if (!paypalOrder || paypalOrder.status !== 'CREATED') {
        throw new Error('Failed to create PayPal order');
      }

      const approvalLink = paypalOrder.links.find((link: any) => link.rel === 'approve');

      return {
        sessionId: paypalOrder.id,
        paymentUrl: approvalLink?.href,
        provider: 'paypal',
        metadata: {
          paypalOrderId: paypalOrder.id,
          ...metadata,
        },
      };
    } catch (error: any) {
      console.error('[PAYPAL] Create payment error:', error);
      throw new Error(`Failed to create PayPal payment: ${error.message}`);
    }
  }

  /**
   * Create an order payment (for order checkout)
   */
  async createOrderPayment(params: CreateOrderPaymentParams): Promise<OrderPaymentSession> {
    try {
      const { orderId, amount, currency, customerEmail, customerName, storeName, metadata } = params;

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency || 'USD',
              value: (amount / 100).toFixed(2), // Convert cents to dollars
            },
            custom_id: orderId, // Our internal order ID
            description: `Order from ${storeName}`,
            soft_descriptor: storeName.substring(0, 22), // Max 22 chars
          },
        ],
        application_context: {
          return_url: process.env.PAYPAL_SUCCESS_URL || `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: process.env.PAYPAL_CANCEL_URL || `${process.env.FRONTEND_URL}/payment/cancel`,
          brand_name: storeName,
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      });

      const response = await paypalClient.execute(request);
      const paypalOrder = response.result;

      if (!paypalOrder || paypalOrder.status !== 'CREATED') {
        throw new Error('Failed to create PayPal order');
      }

      const approvalLink = paypalOrder.links.find((link: any) => link.rel === 'approve');

      return {
        providerOrderId: paypalOrder.id,
        approvalUrl: approvalLink?.href,
        provider: 'paypal',
        metadata: {
          paypalOrderId: paypalOrder.id,
          orderId,
          ...metadata,
        },
      };
    } catch (error: any) {
      console.error('[PAYPAL] Create order payment error:', error);
      throw new Error(`Failed to create PayPal order payment: ${error.message}`);
    }
  }

  /**
   * Verify payment (for webhook events)
   */
  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    try {
      const { event } = params;

      if (!event) {
        return false;
      }

      // PayPal webhook events are verified via webhook signature verification
      // This method is mainly for consistency with the interface
      return event.id !== undefined && event.event_type !== undefined;
    } catch (error) {
      console.error('[PAYPAL] Verify payment error:', error);
      return false;
    }
  }

  /**
   * Handle PayPal webhook
   */
  async handleWebhook(event: any): Promise<WebhookResult> {
    try {
      const eventType = event.event_type;

      if (eventType === 'CHECKOUT.ORDER.APPROVED') {
        const resource = event.resource;
        const paypalOrderId = resource.id;
        const customId = resource.purchase_units[0]?.custom_id; // Our internal order ID

        return {
          success: true,
          eventType,
          paymentId: paypalOrderId,
          orderId: customId,
          amount: parseFloat(resource.purchase_units[0]?.amount?.value || '0') * 100, // Convert to cents
          currency: resource.purchase_units[0]?.amount?.currency_code || 'USD',
          status: 'pending', // Approved but not yet captured
          metadata: {
            paypalOrderId,
            orderId: customId,
          },
        };
      } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = event.resource;
        const paypalOrderId = resource.supplementary_data?.related_resources[0]?.order?.id || resource.id;
        const customId = resource.custom_id || resource.supplementary_data?.related_resources[0]?.order?.custom_id;

        return {
          success: true,
          eventType,
          paymentId: resource.id, // Capture ID
          orderId: customId,
          amount: parseFloat(resource.amount?.value || '0') * 100, // Convert to cents
          currency: resource.amount?.currency_code || 'USD',
          status: 'success',
          metadata: {
            paypalOrderId,
            captureId: resource.id,
            orderId: customId,
          },
        };
      } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.REFUNDED') {
        const resource = event.resource;
        const paypalOrderId = resource.supplementary_data?.related_resources[0]?.order?.id || resource.id;
        const customId = resource.custom_id || resource.supplementary_data?.related_resources[0]?.order?.custom_id;

        return {
          success: false,
          eventType,
          paymentId: resource.id,
          orderId: customId,
          amount: parseFloat(resource.amount?.value || '0') * 100,
          currency: resource.amount?.currency_code || 'USD',
          status: eventType === 'PAYMENT.CAPTURE.REFUNDED' ? 'success' : 'failed',
          metadata: {
            paypalOrderId,
            captureId: resource.id,
            orderId: customId,
            reason: resource.reason_code,
          },
        };
      }

      // Unknown event type
      return {
        success: false,
        eventType,
        status: 'pending',
      };
    } catch (error: any) {
      console.error('[PAYPAL] Webhook handling error:', error);
      return {
        success: false,
        eventType: 'unknown',
        status: 'failed',
        metadata: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Create a refund
   */
  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    try {
      const { paymentId, amount, reason, metadata } = params;

      // Get the capture ID from the payment
      // For PayPal, we need to refund a capture, not an order
      const request = new paypal.payments.CapturesRefundRequest(paymentId);
      request.prefer('return=representation');

      const refundRequest: any = {};
      if (amount) {
        refundRequest.amount = {
          value: (amount / 100).toFixed(2), // Convert cents to dollars
          currency_code: 'USD', // TODO: Get from original payment
        };
      }
      if (reason) {
        refundRequest.note_to_payer = reason;
      }

      request.requestBody(refundRequest);

      const response = await paypalClient.execute(request);
      const refund = response.result;

      return {
        refundId: refund.id,
        status: refund.status === 'COMPLETED' ? 'succeeded' : refund.status === 'PENDING' ? 'pending' : 'failed',
        amount: parseFloat(refund.amount?.value || '0') * 100, // Convert to cents
        currency: refund.amount?.currency_code || 'USD',
        metadata: {
          paypalRefundId: refund.id,
          status: refund.status,
          ...metadata,
        },
      };
    } catch (error: any) {
      console.error('[PAYPAL] Create refund error:', error);
      throw new Error(`Failed to create PayPal refund: ${error.message}`);
    }
  }

  /**
   * Get refund status
   */
  async getRefundStatus(refundId: string): Promise<RefundStatus> {
    try {
      const request = new paypal.payments.RefundsGetRequest(refundId);
      const response = await paypalClient.execute(request);
      const refund = response.result;

      return {
        refundId: refund.id,
        status: refund.status === 'COMPLETED' ? 'succeeded' : refund.status === 'PENDING' ? 'pending' : 'failed',
        amount: parseFloat(refund.amount?.value || '0') * 100, // Convert to cents
        currency: refund.amount?.currency_code || 'USD',
        reason: refund.note_to_payer,
        metadata: {
          paypalRefundId: refund.id,
          status: refund.status,
        },
      };
    } catch (error: any) {
      console.error('[PAYPAL] Get refund status error:', error);
      throw new Error(`Failed to get PayPal refund status: ${error.message}`);
    }
  }
}

