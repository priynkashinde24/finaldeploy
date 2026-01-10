/**
 * Payment Provider Abstraction
 * 
 * PURPOSE:
 * - Gateway-agnostic payment interface
 * - Support Razorpay (India), Stripe (Global), and PayPal (Global)
 * - Business logic must NOT depend on gateway
 * 
 * RULES:
 * - All providers must implement this interface
 * - Webhooks are source of truth
 * - Always verify server-side
 */

export interface PaymentProvider {
  /**
   * Create a subscription payment session
   */
  createSubscription(params: CreateSubscriptionParams): Promise<PaymentSession>;

  /**
   * Create a one-time payment session
   */
  createOneTimePayment(params: CreateOneTimePaymentParams): Promise<PaymentSession>;

  /**
   * Create an order payment (for order checkout)
   */
  createOrderPayment(params: CreateOrderPaymentParams): Promise<OrderPaymentSession>;

  /**
   * Verify payment signature/webhook
   */
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;

  /**
   * Handle webhook event
   */
  handleWebhook(event: any): Promise<WebhookResult>;

  /**
   * Create a refund
   */
  createRefund(params: CreateRefundParams): Promise<RefundResult>;

  /**
   * Get refund status
   */
  getRefundStatus(refundId: string): Promise<RefundStatus>;
}

export interface CreateSubscriptionParams {
  userId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number; // Amount in smallest currency unit (paise for INR, cents for USD)
  currency: string; // 'INR' or 'USD'
  customerEmail: string;
  customerName: string;
  metadata?: Record<string, any>;
}

export interface CreateOneTimePaymentParams {
  userId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface VerifyPaymentParams {
  paymentId: string;
  orderId?: string;
  signature?: string; // Razorpay signature
  event?: any; // Stripe event
}

export interface PaymentSession {
  sessionId: string; // Razorpay order ID or Stripe session ID
  paymentUrl?: string; // Redirect URL for payment
  provider: 'razorpay' | 'stripe' | 'paypal' | 'crypto';
  metadata?: Record<string, any>;
}

export interface CreateOrderPaymentParams {
  orderId: string;
  amount: number; // Amount in smallest currency unit (cents/paise)
  currency: string;
  customerEmail: string;
  customerName: string;
  storeName: string;
  metadata?: Record<string, any>;
}

export interface OrderPaymentSession {
  providerOrderId: string; // Provider's order ID (PayPal order ID, Stripe PaymentIntent ID, etc.)
  approvalUrl?: string; // For PayPal redirect
  clientSecret?: string; // For Stripe Elements
  paymentUrl?: string; // For Razorpay redirect
  provider: 'razorpay' | 'stripe' | 'paypal' | 'crypto';
  metadata?: Record<string, any>;
}

export interface CreateRefundParams {
  paymentId: string; // Provider payment ID
  amount?: number; // Optional for partial refunds (in smallest currency unit)
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  refundId: string; // Provider refund ID
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface RefundStatus {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  amount: number;
  currency: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface WebhookResult {
  success: boolean;
  eventType: string;
  paymentId?: string;
  orderId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  status: 'success' | 'failed' | 'pending';
  metadata?: Record<string, any>;
}

/**
 * Payment provider factory
 */
export function getPaymentProvider(provider: 'razorpay' | 'stripe' | 'paypal'): PaymentProvider {
  if (provider === 'razorpay') {
    // Lazy load to avoid import errors if package not installed
    const { RazorpayProvider } = require('./razorpay.provider');
    return new RazorpayProvider();
  } else if (provider === 'stripe') {
    const { StripeProvider } = require('./stripe.provider');
    return new StripeProvider();
  } else if (provider === 'paypal') {
    const { PayPalProvider } = require('./paypal.provider');
    return new PayPalProvider();
  }
  throw new Error(`Unknown payment provider: ${provider}`);
}

