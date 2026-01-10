import Stripe from 'stripe';
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
 * Stripe Payment Provider
 * 
 * PURPOSE:
 * - Handle payments via Stripe (Global)
 * - Create checkout sessions
 * - Handle subscriptions
 * - Verify webhooks
 */

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('Stripe credentials not configured. Set STRIPE_SECRET_KEY');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16', // Stripe API version (YYYY-MM-DD format)
    });
  }

  /**
   * Create a subscription payment session
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<PaymentSession> {
    try {
      const { userId, planId, billingCycle, amount, currency, customerEmail, customerName, metadata } = params;

      // Create or retrieve customer
      const customers = await this.stripe.customers.list({
        email: customerEmail,
        limit: 1,
      });

      let customerId: string;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await this.stripe.customers.create({
          email: customerEmail,
          name: customerName,
          metadata: {
            userId,
            ...metadata,
          },
        });
        customerId = customer.id;
      }

      // Create checkout session for subscription
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency || 'usd',
              product_data: {
                name: `Subscription - ${planId}`,
                description: `${billingCycle} subscription`,
              },
              unit_amount: amount, // Amount in cents
              recurring: {
                interval: billingCycle === 'yearly' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancel`,
        metadata: {
          userId,
          planId,
          billingCycle,
          ...metadata,
        },
      });

      return {
        sessionId: session.id,
        paymentUrl: session.url || undefined,
        provider: 'stripe',
        metadata: {
          customerId,
          sessionId: session.id,
        },
      };
    } catch (error: any) {
      console.error('[STRIPE] Create subscription error:', error);
      throw new Error(`Failed to create Stripe subscription: ${error.message}`);
    }
  }

  /**
   * Create an order payment (for order checkout)
   */
  async createOrderPayment(params: CreateOrderPaymentParams): Promise<OrderPaymentSession> {
    try {
      const { orderId, amount, currency, customerEmail, customerName, storeName, metadata } = params;

      // Create PaymentIntent for order
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount, // Already in cents
        currency: currency || 'usd',
        metadata: {
          orderId,
          customerEmail,
          customerName,
          storeName,
          ...metadata,
        },
      });

      return {
        providerOrderId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        provider: 'stripe',
        metadata: {
          paymentIntentId: paymentIntent.id,
          orderId,
          ...metadata,
        },
      };
    } catch (error: any) {
      console.error('[STRIPE] Create order payment error:', error);
      throw new Error(`Failed to create Stripe order payment: ${error.message}`);
    }
  }

  /**
   * Create a one-time payment session
   */
  async createOneTimePayment(params: CreateOneTimePaymentParams): Promise<PaymentSession> {
    try {
      const { userId, amount, currency, customerEmail, customerName, description, metadata } = params;

      // Create checkout session for one-time payment
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency || 'usd',
              product_data: {
                name: description || 'Payment',
              },
              unit_amount: amount, // Amount in cents
            },
            quantity: 1,
          },
        ],
        customer_email: customerEmail,
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancel`,
        metadata: {
          userId,
          customerName,
          ...metadata,
        },
      });

      return {
        sessionId: session.id,
        paymentUrl: session.url || undefined,
        provider: 'stripe',
        metadata: {
          sessionId: session.id,
        },
      };
    } catch (error: any) {
      console.error('[STRIPE] Create payment error:', error);
      throw new Error(`Failed to create Stripe payment: ${error.message}`);
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

      // Stripe webhook events are already verified via webhook signature
      // This method is mainly for consistency with the interface
      return event.type !== undefined;
    } catch (error) {
      console.error('[STRIPE] Verify payment error:', error);
      return false;
    }
  }

  /**
   * Handle Stripe webhook
   */
  async handleWebhook(event: Stripe.Event): Promise<WebhookResult> {
    try {
      const eventType = event.type;

      if (eventType === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // For subscription mode, get subscription ID
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);
          return {
            success: subscription.status === 'active',
            eventType,
            paymentId: session.payment_intent as string || session.id,
            orderId: session.id,
            subscriptionId: subscription.id,
            amount: subscription.items.data[0]?.price.unit_amount || 0,
            currency: subscription.currency,
            status: subscription.status === 'active' ? 'success' : 'pending',
            metadata: {
              customerId: session.customer as string,
              subscriptionId: subscription.id,
              metadata: session.metadata,
            },
          };
        }

        // For payment mode, get payment intent
        if (session.payment_intent) {
          const paymentIntent = await this.stripe.paymentIntents.retrieve(session.payment_intent as string);
          return {
            success: paymentIntent.status === 'succeeded',
            eventType,
            paymentId: paymentIntent.id,
            orderId: session.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status === 'succeeded' ? 'success' : 'failed',
            metadata: {
              customerId: session.customer as string,
              metadata: session.metadata,
            },
          };
        }

        // Fallback
        return {
          success: session.payment_status === 'paid',
          eventType,
          paymentId: session.id,
          orderId: session.id,
          amount: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: session.payment_status === 'paid' ? 'success' : 'pending',
          metadata: {
            customerId: session.customer as string,
            metadata: session.metadata,
          },
        };
      } else if (eventType === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          success: true,
          eventType,
          paymentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'success',
          metadata: {
            customerId: paymentIntent.customer as string,
          },
        };
      } else if (eventType === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          success: false,
          eventType,
          paymentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'failed',
          metadata: {
            error: paymentIntent.last_payment_error?.message,
          },
        };
      } else if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          success: true,
          eventType,
          subscriptionId: subscription.id,
          amount: subscription.items.data[0]?.price.unit_amount || 0,
          currency: subscription.currency,
          status: subscription.status === 'active' ? 'success' : 'pending',
          metadata: {
            subscriptionId: subscription.id,
            customerId: subscription.customer as string,
            status: subscription.status,
          },
        };
      } else if (eventType === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          success: true,
          eventType,
          subscriptionId: subscription.id,
          status: 'failed',
          metadata: {
            subscriptionId: subscription.id,
            status: 'cancelled',
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
      console.error('[STRIPE] Webhook handling error:', error);
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

      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentId,
        metadata: metadata || {},
      };

      if (amount) {
        refundParams.amount = amount;
      }

      if (reason) {
        refundParams.reason = reason as 'duplicate' | 'fraudulent' | 'requested_by_customer';
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        refundId: refund.id,
        status: refund.status === 'succeeded' ? 'succeeded' : refund.status === 'pending' ? 'pending' : 'failed',
        amount: refund.amount,
        currency: refund.currency,
        metadata: {
          stripeRefundId: refund.id,
          status: refund.status,
          ...metadata,
        },
      };
    } catch (error: any) {
      console.error('[STRIPE] Create refund error:', error);
      throw new Error(`Failed to create Stripe refund: ${error.message}`);
    }
  }

  /**
   * Get refund status
   */
  async getRefundStatus(refundId: string): Promise<RefundStatus> {
    try {
      const refund = await this.stripe.refunds.retrieve(refundId);

      return {
        refundId: refund.id,
        status: refund.status === 'succeeded' ? 'succeeded' : refund.status === 'pending' ? 'pending' : 'failed',
        amount: refund.amount,
        currency: refund.currency,
        reason: refund.reason || undefined,
        metadata: {
          stripeRefundId: refund.id,
          status: refund.status,
        },
      };
    } catch (error: any) {
      console.error('[STRIPE] Get refund status error:', error);
      throw new Error(`Failed to get Stripe refund status: ${error.message}`);
    }
  }
}

