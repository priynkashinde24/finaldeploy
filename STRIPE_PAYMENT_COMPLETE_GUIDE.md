# Stripe Payment Integration - Complete Implementation Guide

## 🎯 Overview

This document provides a complete guide to the Stripe Payment Integration system, including all features from basic payments to advanced Connect payouts, refunds, and monitoring.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Payment Flow](#core-payment-flow)
3. [Stripe Connect (Supplier Payouts)](#stripe-connect-supplier-payouts)
4. [Refunds & Partial Refunds](#refunds--partial-refunds)
5. [Failed Payment Recovery](#failed-payment-recovery)
6. [Webhook Retry Monitoring](#webhook-retry-monitoring)
7. [API Reference](#api-reference)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### Payment Flow
```
Frontend → Create Intent → Stripe Processes → Webhook Confirms → System Updates
```

### Key Principles
- ✅ **Webhooks are source of truth** - Never mark paid outside webhook
- ✅ **Idempotent processing** - Duplicate events safely ignored
- ✅ **Transactional operations** - All updates in MongoDB transactions
- ✅ **Inventory integration** - Reservations consumed on payment success
- ✅ **Secure** - Always verify Stripe signature

---

## 💳 Core Payment Flow

### 1. Create Payment Intent

**Endpoint**: `POST /api/payments/stripe/create-intent`

**Request**:
```json
{
  "orderId": "order_1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx"
  }
}
```

**Flow**:
1. Validates user and store context
2. Fetches order
3. Ensures inventory is already RESERVED
4. Creates Stripe PaymentIntent
5. Saves PaymentIntent record
6. Returns clientSecret for frontend

### 2. Frontend Payment Confirmation

**Frontend Code** (React example):
```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
    });

    if (error) {
      // Handle error
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe}>
        Pay
      </button>
    </form>
  );
}
```

**Important**: Frontend NEVER updates order status. Only webhooks do.

### 3. Webhook Processing

**Endpoint**: `POST /api/webhooks/stripe` (NO auth, signature verified)

**Events Handled**:
- `payment_intent.succeeded` → Mark order paid, consume inventory, process payouts
- `payment_intent.payment_failed` → Mark order failed, release inventory

---

## 🔗 Stripe Connect (Supplier Payouts)

### Overview

Stripe Connect enables direct payouts to supplier accounts. Suppliers create Connect accounts, complete onboarding, and receive automatic payouts when orders are paid.

### 1. Create Connect Account

**Endpoint**: `POST /api/payments/stripe/connect/create-account`

**Request**: None (uses authenticated supplier)

**Response**:
```json
{
  "success": true,
  "data": {
    "accountId": "acct_xxx",
    "onboardingLink": "https://connect.stripe.com/setup/xxx",
    "status": "pending",
    "onboardingStatus": "incomplete"
  }
}
```

**Flow**:
1. Creates Stripe Express account
2. Generates onboarding link
3. Returns link for supplier to complete onboarding

### 2. Get Account Status

**Endpoint**: `GET /api/payments/stripe/connect/account`

**Response**:
```json
{
  "success": true,
  "data": {
    "accountId": "acct_xxx",
    "status": "enabled",
    "onboardingStatus": "complete",
    "payoutsEnabled": true,
    "chargesEnabled": true
  }
}
```

### 3. Automatic Payouts

When an order is paid (via webhook):
1. System finds pending supplier payouts
2. Creates Stripe transfer to supplier Connect account
3. Updates payout status to 'processed'
4. Logs transfer for audit

**Payout Amount**: Supplier receives `costAmount` (cost price × quantity)

---

## 💰 Refunds & Partial Refunds

### 1. Create Full Refund

**Endpoint**: `POST /api/payments/stripe/refunds/create`

**Request**:
```json
{
  "orderId": "order_1234567890",
  "refundType": "full",
  "reason": "Customer requested refund"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "refundId": "refund_xxx",
    "stripeRefundId": "re_xxx",
    "amount": 100.00,
    "status": "succeeded",
    "inventoryRestored": true
  }
}
```

### 2. Create Partial Refund

**Request**:
```json
{
  "orderId": "order_1234567890",
  "refundType": "partial",
  "amount": 50.00,
  "reason": "Defective item",
  "items": [
    {
      "productId": "prod_xxx",
      "variantId": "var_xxx",
      "quantity": 1
    }
  ]
}
```

**Flow**:
1. Validates refund amount doesn't exceed order amount
2. Creates Stripe refund
3. Restores inventory for refunded items
4. Updates refund status

### 3. Get Order Refunds

**Endpoint**: `GET /api/payments/stripe/refunds/:orderId`

**Response**:
```json
{
  "success": true,
  "data": {
    "refunds": [
      {
        "refundId": "refund_xxx",
        "refundType": "full",
        "amount": 100.00,
        "status": "succeeded",
        "inventoryRestored": true,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

## 🔄 Failed Payment Recovery

### Automatic Retry

Failed webhook processing automatically creates retry records with exponential backoff:
- 1st retry: 5 minutes
- 2nd retry: 15 minutes
- 3rd retry: 45 minutes
- 4th retry: 2 hours
- 5th retry: 6 hours
- After 5 retries: Abandoned (requires manual intervention)

### Manual Retry

**Endpoint**: `POST /api/admin/webhooks/retries/:id/retry`

**Request**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "retry": {
      "id": "retry_xxx",
      "status": "pending",
      "retryCount": 0
    }
  }
}
```

### Customer Notifications

When payment fails:
1. System releases inventory reservation
2. Emits `order.payment_failed` event
3. Frontend can listen to event and notify customer
4. Customer can retry payment with same PaymentIntent

---

## 📊 Webhook Retry Monitoring

### 1. Webhook Health Dashboard

**Endpoint**: `GET /api/admin/webhooks/health`

**Response**:
```json
{
  "success": true,
  "data": {
    "health": {
      "events": {
        "total": 1000,
        "processed": 995,
        "failed": 5,
        "successRate": "99.50"
      },
      "retries": {
        "pending": 3,
        "processing": 1,
        "abandoned": 1
      },
      "status": "warning"
    }
  }
}
```

### 2. View Retries

**Endpoint**: `GET /api/admin/webhooks/retries?status=pending&limit=50`

**Response**:
```json
{
  "success": true,
  "data": {
    "retries": [
      {
        "id": "retry_xxx",
        "stripeEventId": "evt_xxx",
        "eventType": "payment_intent.succeeded",
        "retryCount": 2,
        "status": "pending",
        "nextRetryAt": "2024-01-01T00:05:00Z",
        "error": "Database connection timeout"
      }
    ]
  }
}
```

### 3. Background Retry Job

**Cron Job**: Run every 5 minutes
```typescript
import { runGlobalWebhookRetryJob } from './jobs/webhookRetry.job';

cron.schedule('*/5 * * * *', async () => {
  await runGlobalWebhookRetryJob();
});
```

---

## 📚 API Reference

### Payment Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/stripe/create-intent` | Yes | Create payment intent |
| GET | `/api/payments/stripe/intent/:id` | Yes | Get payment intent status |

### Connect Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/stripe/connect/create-account` | Supplier | Create Connect account |
| GET | `/api/payments/stripe/connect/account` | Supplier | Get account status |
| POST | `/api/payments/stripe/connect/create-onboarding-link` | Supplier | Create onboarding link |

### Refund Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/stripe/refunds/create` | Yes | Create refund |
| GET | `/api/payments/stripe/refunds/:orderId` | Yes | Get order refunds |

### Monitoring Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/webhooks/health` | Admin | Get webhook health |
| GET | `/api/admin/webhooks/retries` | Admin | Get retries |
| POST | `/api/admin/webhooks/retries/:id/retry` | Admin | Manually retry |

---

## 🔒 Security Best Practices

### 1. Webhook Security

- ✅ **Always verify signature** - Never process unsigned webhooks
- ✅ **Use raw body** - `express.raw({ type: 'application/json' })` for webhook endpoint
- ✅ **No authentication** - Webhook endpoint should NOT require auth (signature is auth)

### 2. Payment Security

- ✅ **Never trust frontend** - Frontend success doesn't mean payment succeeded
- ✅ **Webhook is source of truth** - Only webhooks update order status
- ✅ **Idempotency** - Use Stripe event IDs to prevent duplicate processing

### 3. Connect Security

- ✅ **Supplier-only access** - Only suppliers can create Connect accounts
- ✅ **Onboarding required** - Payouts only processed if account is onboarded
- ✅ **Status checks** - Verify `payoutsEnabled` before processing transfers

---

## 🐛 Troubleshooting

### Payment Intent Creation Fails

**Error**: "Inventory must be reserved before creating payment intent"

**Solution**: Ensure inventory is reserved during checkout before creating payment intent.

### Webhook Signature Verification Fails

**Error**: "Webhook signature verification failed"

**Solution**: 
1. Check `STRIPE_WEBHOOK_SECRET` is correct
2. Ensure webhook endpoint uses `express.raw()` middleware
3. Verify webhook URL in Stripe dashboard matches your endpoint

### Payout Processing Fails

**Error**: "Payouts not enabled for this account"

**Solution**:
1. Supplier must complete Stripe Connect onboarding
2. Check account status via `GET /api/payments/stripe/connect/account`
3. Ensure `payoutsEnabled: true` before processing

### Refund Inventory Not Restored

**Error**: Inventory not restored after refund

**Solution**:
1. Check refund status is 'succeeded'
2. Verify `inventoryRestored` flag in refund record
3. Check inventory restoration logs for errors

### Webhook Retries Not Processing

**Error**: Retries stuck in 'pending' status

**Solution**:
1. Ensure retry job is running (cron every 5 minutes)
2. Check `nextRetryAt` is in the past
3. Verify retry count hasn't exceeded max retries

---

## 🚀 Next Steps

1. **Set Environment Variables**:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_SUCCESS_URL=https://yourapp.com/payment/success
   STRIPE_CANCEL_URL=https://yourapp.com/payment/cancel
   ```

2. **Configure Stripe Webhook**:
   - URL: `https://yourapi.com/api/webhooks/stripe`
   - Events: All payment and subscription events

3. **Set Up Cron Jobs**:
   ```typescript
   // Webhook retry job (every 5 minutes)
   cron.schedule('*/5 * * * *', async () => {
     await runGlobalWebhookRetryJob();
   });
   ```

4. **Frontend Integration**:
   - Install `@stripe/react-stripe-js` and `@stripe/stripe-js`
   - Implement Stripe Elements checkout
   - Handle payment success/failure redirects

---

## 📞 Support

For issues or questions:
1. Check webhook health dashboard
2. Review webhook retry logs
3. Check Stripe dashboard for payment status
4. Review audit logs for payment events

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Status**: ✅ Production Ready

