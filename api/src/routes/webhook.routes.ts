import { Router } from 'express';
import express from 'express';
import {
  handleRazorpayWebhook,
  handleStripeWebhook,
} from '../controllers/paymentWebhook.controller';

const router = Router();

// Webhook routes don't use JSON parser (need raw body for signature verification)
// They should be registered with express.raw({ type: 'application/json' })

// POST /webhooks/razorpay - Razorpay webhook
router.post('/razorpay', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

// POST /webhooks/stripe - Stripe webhook
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;

