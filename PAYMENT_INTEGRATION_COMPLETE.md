# Payment Integration Complete Guide

## 🎯 Overview

This document provides a comprehensive guide to the unified payment system supporting **Stripe**, **PayPal**, and **Razorpay** with enterprise-grade features including refunds, payouts, and payment recovery.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Payment Providers](#payment-providers)
3. [Order Payment Flow](#order-payment-flow)
4. [Refunds](#refunds)
5. [Supplier Payouts](#supplier-payouts)
6. [Payment Recovery](#payment-recovery)
7. [Webhooks](#webhooks)
8. [API Reference](#api-reference)
9. [Security Best Practices](#security-best-practices)
10. [Testing](#testing)

---

## 🏗️ Architecture Overview

### Core Principles

1. **Webhook is Source of Truth**: Payment status is ONLY updated via webhooks
2. **Frontend Never Marks Paid**: Frontend only redirects; webhook confirms payment
3. **Idempotent Processing**: Duplicate webhook events are safely ignored
4. **Transactional Integrity**: Critical operations wrapped in MongoDB transactions
5. **Provider Agnostic**: Unified interface for all payment providers

### Payment Flow

```
Frontend → Create Payment Intent/Order → Redirect to Provider
Provider → Process Payment → Webhook → System Updates Order & Inventory
```

---

## 💳 Payment Providers

### Supported Providers

- **Stripe**: Global payments, subscriptions, Connect payouts
- **PayPal**: Global payments, PayPal Payouts
- **Razorpay**: India-focused payments

### Provider Selection

The system uses a unified `PaymentProvider` interface that abstracts provider-specific logic:

```typescript
import { getPaymentProvider } from './payments/paymentProvider';

const provider = getPaymentProvider('stripe'); // or 'paypal', 'razorpay'
```

### Provider-Specific Features

| Feature | Stripe | PayPal | Razorpay |
|---------|--------|--------|----------|
| Order Payments | ✅ | ✅ | ✅ |
| Subscriptions | ✅ | ❌ | ❌ |
| Refunds | ✅ | ✅ | ❌ |
| Payouts | ✅ (Connect) | ✅ (Payouts) | ❌ |

---

## 🛒 Order Payment Flow

### Step 1: Create Payment Intent/Order

#### Stripe

```typescript
POST /api/payments/stripe/create-intent
{
  "orderId": "order_123"
}

Response:
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

#### PayPal

```typescript
POST /api/payments/paypal/create-order
{
  "orderId": "order_123"
}

Response:
{
  "approvalUrl": "https://www.paypal.com/checkoutnow?token=xxx",
  "paypalOrderId": "5O190127TN364715T"
}
```

### Step 2: Frontend Payment Processing

#### Stripe (Elements)

```typescript
import { Elements } from '@stripe/react-stripe-js';
import { PaymentElement } from '@stripe/react-stripe-js';

// Use clientSecret from create-intent response
<Elements stripe={stripePromise} options={{ clientSecret }}>
  <PaymentElement />
</Elements>
```

#### PayPal (Buttons)

```typescript
import { PayPalButtons } from '@paypal/react-paypal-js';

<PayPalButtons
  createOrder={async () => {
    const response = await fetch('/api/payments/paypal/create-order', {
      method: 'POST',
      body: JSON.stringify({ orderId: 'order_123' })
    });
    const { paypalOrderId } = await response.json();
    return paypalOrderId;
  }}
  onApprove={async (data) => {
    // Redirect to success page
    // Webhook will confirm payment
  }}
/>
```

### Step 3: Webhook Confirmation

**Never trust frontend redirects.** Webhooks are the source of truth:

- **Stripe**: `payment_intent.succeeded` → Update order status
- **PayPal**: `PAYMENT.CAPTURE.COMPLETED` → Update order status

---

## 💰 Refunds

### Full Refund

```typescript
POST /api/payments/stripe/refunds/create
POST /api/payments/paypal/refunds/create

{
  "orderId": "order_123",
  "refundType": "full",
  "reason": "Customer requested refund"
}
```

### Partial Refund

```typescript
POST /api/payments/stripe/refunds/create
POST /api/payments/paypal/refunds/create

{
  "orderId": "order_123",
  "refundType": "partial",
  "amount": 50.00,
  "items": [
    {
      "productId": "prod_123",
      "variantId": "var_123",
      "quantity": 1
    }
  ],
  "reason": "Item damaged"
}
```

### Get Refunds

```typescript
GET /api/payments/stripe/refunds/:orderId
GET /api/payments/paypal/refunds/:orderId
```

### Refund Features

- ✅ Automatic inventory restoration
- ✅ Full and partial refunds
- ✅ Provider-agnostic interface
- ✅ Audit logging
- ✅ Transactional integrity

---

## 💸 Supplier Payouts

### Stripe Connect Payouts

```typescript
// Process payout for a supplier
POST /api/supplier-payouts/process
{
  "supplierPayoutId": "payout_123"
}
```

### PayPal Payouts

```typescript
// Process payout via PayPal Payouts API
// Requires supplier PayPal email in payout metadata
```

### Payout Flow

1. Order payment succeeds → Webhook triggers
2. System calculates supplier payout amount
3. Creates `SupplierPayout` record
4. Processes payout via provider (Stripe Connect or PayPal Payouts)
5. Updates payout status
6. Audit log created

---

## 🔄 Payment Recovery

### Retry Failed Payment

```typescript
POST /api/payments/recovery/retry
{
  "orderId": "order_123",
  "provider": "stripe" // Optional: auto-detected if not provided
}

Response:
{
  "clientSecret": "pi_xxx_secret_xxx", // For Stripe
  "approvalUrl": "https://...", // For PayPal
  "provider": "stripe"
}
```

### Get Payment Status

```typescript
GET /api/payments/recovery/status/:orderId

Response:
{
  "orderId": "order_123",
  "orderStatus": "pending",
  "paymentStatus": "pending",
  "provider": "stripe",
  "canRetry": true,
  "payment": {
    "provider": "stripe",
    "status": "failed",
    "amount": 10000,
    "currency": "USD"
  }
}
```

### Recovery Features

- ✅ Retry failed payments
- ✅ Auto-detect payment provider
- ✅ Status tracking
- ✅ Customer-friendly UX

---

## 📡 Webhooks

### Webhook Endpoints

- **Stripe**: `/api/webhooks/stripe` (raw body, signature verified)
- **PayPal**: `/api/webhooks/paypal` (JSON body, signature verified)

### Webhook Security

1. **Signature Verification**: Mandatory for all webhooks
2. **No Authentication**: Webhook endpoints are public (signature is auth)
3. **Idempotency**: Duplicate events are safely ignored
4. **Raw Body**: Stripe requires raw body for signature verification

### Webhook Events

#### Stripe

- `payment_intent.succeeded` → Mark order paid, consume inventory
- `payment_intent.payment_failed` → Mark order failed, release inventory
- `checkout.session.completed` → Handle subscription activation

#### PayPal

- `PAYMENT.CAPTURE.COMPLETED` → Mark order paid, consume inventory
- `PAYMENT.CAPTURE.DENIED` → Mark order failed, release inventory
- `CHECKOUT.ORDER.APPROVED` → Mark payment approved (pending capture)

---

## 📚 API Reference

### Payment Creation

| Endpoint | Method | Provider | Auth |
|----------|--------|----------|------|
| `/api/payments/stripe/create-intent` | POST | Stripe | ✅ |
| `/api/payments/paypal/create-order` | POST | PayPal | ✅ |

### Refunds

| Endpoint | Method | Provider | Auth |
|----------|--------|----------|------|
| `/api/payments/stripe/refunds/create` | POST | Stripe | ✅ |
| `/api/payments/paypal/refunds/create` | POST | PayPal | ✅ |
| `/api/payments/stripe/refunds/:orderId` | GET | Stripe | ✅ |
| `/api/payments/paypal/refunds/:orderId` | GET | PayPal | ✅ |

### Payment Recovery

| Endpoint | Method | Auth |
|----------|--------|------|
| `/api/payments/recovery/retry` | POST | ✅ |
| `/api/payments/recovery/status/:orderId` | GET | ✅ |

### Webhooks

| Endpoint | Method | Provider | Auth |
|----------|--------|----------|------|
| `/api/webhooks/stripe` | POST | Stripe | ❌ (Signature) |
| `/api/webhooks/paypal` | POST | PayPal | ❌ (Signature) |

---

## 🔒 Security Best Practices

### ✅ DO

- ✅ Always verify webhook signatures
- ✅ Use webhooks as source of truth
- ✅ Store payment provider IDs for idempotency
- ✅ Wrap critical operations in transactions
- ✅ Log all payment events
- ✅ Never expose API keys to frontend

### ❌ DON'T

- ❌ Mark orders paid from frontend
- ❌ Trust redirect success URLs
- ❌ Skip webhook verification
- ❌ Process duplicate webhook events
- ❌ Mutate order status outside webhooks

---

## 🧪 Testing

### Test Scenarios

1. **Successful Payment**
   - Create payment intent/order
   - Complete payment on provider
   - Verify webhook updates order
   - Verify inventory consumed

2. **Failed Payment**
   - Create payment intent/order
   - Fail payment on provider
   - Verify webhook releases inventory
   - Verify order status = failed

3. **Refund**
   - Create refund
   - Verify inventory restored
   - Verify refund status tracked

4. **Payment Recovery**
   - Fail payment
   - Retry payment
   - Verify new payment intent/order created
   - Complete payment
   - Verify order paid

5. **Duplicate Webhook**
   - Send same webhook twice
   - Verify idempotency (no duplicate processing)

### Test Commands

```bash
# Test Stripe webhook
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "stripe-signature: ..." \
  -d @stripe_webhook.json

# Test PayPal webhook
curl -X POST http://localhost:3000/api/webhooks/paypal \
  -H "paypal-transmission-sig: ..." \
  -d @paypal_webhook.json
```

---

## 🚀 Environment Variables

### Stripe

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://yourapp.com/payment/success
STRIPE_CANCEL_URL=https://yourapp.com/payment/cancel
```

### PayPal

```env
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_ENV=sandbox # or 'live'
PAYPAL_SUCCESS_URL=https://yourapp.com/payment/success
PAYPAL_CANCEL_URL=https://yourapp.com/payment/cancel
```

---

## 📊 Models

### Payment

```typescript
{
  storeId: ObjectId,
  orderId: ObjectId,
  provider: 'stripe' | 'paypal' | 'razorpay',
  providerOrderId: string,
  amount: number, // cents
  currency: string,
  status: 'created' | 'approved' | 'paid' | 'failed',
  metadata: {}
}
```

### Refund

```typescript
{
  storeId: ObjectId,
  orderId: string,
  paymentIntentId: string,
  stripeRefundId?: string,
  paypalRefundId?: string,
  refundType: 'full' | 'partial',
  amount: number, // cents
  status: 'pending' | 'succeeded' | 'failed',
  itemsRefunded: Array<{...}>,
  inventoryRestored: boolean
}
```

---

## 🎓 Key Takeaways

1. **Webhooks = Truth**: Never trust frontend redirects
2. **Idempotency**: Always check for duplicate events
3. **Transactions**: Wrap critical operations
4. **Provider Agnostic**: Use unified interface
5. **Security First**: Verify signatures, log everything

---

## 🔗 Related Documentation

- [Stripe Payment Integration](./STRIPE_PAYMENT_COMPLETE_GUIDE.md)
- [PayPal Payment Integration](./PAYPAL_PAYMENT_COMPLETE_GUIDE.md)
- [Inventory Reservation System](./INVENTORY_RESERVATION_GUIDE.md)
- [Audit Logging](./AUDIT_LOGGING_GUIDE.md)

---

## 📞 Support

For issues or questions:
1. Check webhook logs in `/api/admin/webhooks`
2. Review audit logs for payment events
3. Verify environment variables
4. Test webhook signatures

---

**Last Updated**: 2024
**Version**: 1.0.0

