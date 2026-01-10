# Payment Integration Setup

## Required Environment Variables

Add these to your `.env` file:

```env
# Razorpay (India)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Stripe (Global)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

## Required NPM Packages

Install the payment provider packages:

```bash
npm install razorpay stripe
npm install --save-dev @types/node
```

## Webhook Configuration

### Razorpay Webhooks

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/razorpay`
3. Select events:
   - `payment.captured`
   - `payment.failed`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
4. Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`

### Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

## Testing

### Razorpay Test Mode

Use test keys from Razorpay Dashboard → Settings → API Keys

### Stripe Test Mode

Use test keys from Stripe Dashboard → Developers → API Keys

## Architecture

- **Gateway-agnostic**: Business logic doesn't depend on payment provider
- **Webhook-driven**: Webhooks are source of truth for payment status
- **Idempotent**: Webhook handlers are safe to retry
- **Secure**: All webhooks verify signatures



