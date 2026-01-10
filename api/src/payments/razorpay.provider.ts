import Razorpay from 'razorpay';
import crypto from 'crypto';
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

/**
 * Razorpay Payment Provider
 * 
 * PURPOSE:
 * - Handle payments via Razorpay (India)
 * - Create orders and subscriptions
 * - Verify signatures
 * - Handle webhooks
 */

export class RazorpayProvider implements PaymentProvider {
  private razorpay: Razorpay;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  /**
   * Create a subscription payment session
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<PaymentSession> {
    try {
      const { userId, planId, billingCycle, amount, currency, customerEmail, customerName, metadata } = params;

      // Create Razorpay plan (if not exists, or use existing)
      // For simplicity, we'll create a subscription directly
      const subscription = await this.razorpay.subscriptions.create({
        plan_id: planId, // In production, create Razorpay plan first
        customer_notify: 1,
        total_count: billingCycle === 'yearly' ? 12 : 1, // Number of billing cycles
        notes: {
          userId,
          planId,
          billingCycle,
          ...metadata,
        },
      });

      return {
        sessionId: subscription.id,
        paymentUrl: undefined, // Razorpay subscriptions don't have direct payment URLs
        provider: 'razorpay',
        metadata: {
          subscriptionId: subscription.id,
          status: subscription.status,
        },
      };
    } catch (error: any) {
      console.error('[RAZORPAY] Create subscription error:', error);
      throw new Error(`Failed to create Razorpay subscription: ${error.message}`);
    }
  }

  /**
   * Create an order payment (for order checkout)
   */
  async createOrderPayment(params: CreateOrderPaymentParams): Promise<OrderPaymentSession> {
    try {
      const { orderId, amount, currency, customerEmail, customerName, storeName, metadata } = params;

      const orderParams: any = {
        amount: amount, // Amount in paise
        currency: currency || 'INR',
        receipt: orderId,
        notes: {
          orderId,
          customerEmail,
          customerName,
          storeName,
          ...metadata,
        },
      };

      const order = await this.razorpay.orders.create(orderParams);

      return {
        providerOrderId: order.id as string,
        paymentUrl: undefined, // Frontend will use Razorpay Checkout
        provider: 'razorpay',
        metadata: {
          orderId: order.id as string,
          amount: order.amount as number,
          currency: order.currency as string,
        },
      };
    } catch (error: any) {
      console.error('[RAZORPAY] Create order payment error:', error);
      throw new Error(`Failed to create Razorpay order payment: ${error.message}`);
    }
  }

  /**
   * Create a one-time payment session (order)
   */
  async createOneTimePayment(params: CreateOneTimePaymentParams): Promise<PaymentSession> {
    try {
      const { amount, currency, customerEmail, customerName, description, metadata } = params;

      const orderParams: any = {
        amount: amount, // Amount in paise
        currency: currency || 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: {
          customerEmail,
          customerName,
          ...(description ? { description } : {}),
          ...metadata,
        },
      };

      const order = await this.razorpay.orders.create(orderParams);

      return {
        sessionId: order.id as string,
        paymentUrl: undefined, // Frontend will use Razorpay Checkout
        provider: 'razorpay',
        metadata: {
          orderId: order.id as string,
          amount: order.amount as number,
          currency: order.currency as string,
        },
      };
    } catch (error: any) {
      console.error('[RAZORPAY] Create order error:', error);
      throw new Error(`Failed to create Razorpay order: ${error.message}`);
    }
  }

  /**
   * Verify payment signature
   */
  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    try {
      const { paymentId, orderId, signature } = params;

      if (!paymentId || !orderId || !signature) {
        return false;
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error('RAZORPAY_KEY_SECRET not configured');
      }

      // Generate expected signature
      const text = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(text)
        .digest('hex');

      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[RAZORPAY] Verify payment error:', error);
      return false;
    }
  }

  /**
   * Handle Razorpay webhook
   */
  async handleWebhook(event: any): Promise<WebhookResult> {
    try {
      const { event: eventType, payload } = event;

      // Verify webhook signature (if provided)
      // Razorpay sends X-Razorpay-Signature header

      if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
        const payment = payload.payment.entity;
        return {
          success: true,
          eventType,
          paymentId: payment.id,
          orderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'success',
          metadata: {
            method: payment.method,
            bank: payment.bank,
            wallet: payment.wallet,
          },
        };
      } else if (eventType === 'payment.failed') {
        const payment = payload.payment.entity;
        return {
          success: false,
          eventType,
          paymentId: payment.id,
          orderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'failed',
          metadata: {
            error: payment.error_description,
          },
        };
      } else if (eventType === 'subscription.activated' || eventType === 'subscription.charged') {
        const subscription = payload.subscription.entity;
        return {
          success: true,
          eventType,
          subscriptionId: subscription.id,
          amount: subscription.plan_amount,
          currency: subscription.plan_currency,
          status: 'success',
          metadata: {
            subscriptionId: subscription.id,
            status: subscription.status,
          },
        };
      } else if (eventType === 'subscription.cancelled') {
        const subscription = payload.subscription.entity;
        return {
          success: true,
          eventType,
          subscriptionId: subscription.id,
          status: 'failed',
          metadata: {
            subscriptionId: subscription.id,
            status: subscription.status,
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
      console.error('[RAZORPAY] Webhook handling error:', error);
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

      // Razorpay refunds are created via payments.refund() method
      const refundParams: any = {
        amount: amount, // Amount in paise (optional for partial refund)
        notes: {
          ...(reason ? { reason } : {}),
          ...metadata,
        },
      };

      // Use payments.refund() method
      const refund = await (this.razorpay.payments as any).refund(paymentId, refundParams);

      return {
        refundId: refund.id as string,
        status: refund.status === 'processed' ? 'succeeded' : refund.status === 'pending' ? 'pending' : 'failed',
        amount: refund.amount as number,
        currency: refund.currency as string,
        metadata: {
          razorpayRefundId: refund.id as string,
          status: refund.status,
          ...metadata,
        },
      };
    } catch (error: any) {
      console.error('[RAZORPAY] Create refund error:', error);
      throw new Error(`Failed to create Razorpay refund: ${error.message}`);
    }
  }

  /**
   * Get refund status
   */
  async getRefundStatus(refundId: string): Promise<RefundStatus> {
    try {
      const refund = await this.razorpay.refunds.fetch(refundId);

      return {
        refundId: refund.id as string,
        status: refund.status === 'processed' ? 'succeeded' : refund.status === 'pending' ? 'pending' : 'failed',
        amount: refund.amount as number,
        currency: refund.currency as string,
        reason: typeof refund.notes?.reason === 'string' ? refund.notes.reason : undefined,
        metadata: {
          razorpayRefundId: refund.id as string,
          status: refund.status,
        },
      };
    } catch (error: any) {
      console.error('[RAZORPAY] Get refund status error:', error);
      throw new Error(`Failed to get Razorpay refund status: ${error.message}`);
    }
  }
}

