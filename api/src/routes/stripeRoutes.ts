import { Router } from 'express';
import {
  createPaymentIntent,
  getPaymentIntent,
} from '../controllers/stripePayment.controller';
import { createStripeSubscription } from '../controllers/stripeSubscription.controller';
import { handleStripeWebhook } from '../controllers/stripeWebhook.controller';
import {
  createConnectAccount,
  getConnectAccount,
  createOnboardingLink,
} from '../controllers/stripeConnect.controller';
import {
  createRefund,
  getOrderRefunds,
} from '../controllers/stripeRefund.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import { pciSanitizeMiddleware } from '../middleware/pciCompliance.middleware';

const router = Router();

// Apply PCI compliance sanitization to all Stripe routes (except webhooks which use raw body)
// Note: Webhook routes are registered separately in app.ts with raw body parser
router.use((req, res, next) => {
  // Skip sanitization for webhook endpoints (they use raw body and are verified by signature)
  if (req.path.includes('/webhook')) {
    return next();
  }
  return pciSanitizeMiddleware(req, res, next);
});

// Payment intent routes (require auth and store)
router.post('/create-intent', authenticate, resolveStore, createPaymentIntent);
router.get('/intent/:paymentIntentId', authenticate, resolveStore, getPaymentIntent);

// Subscription routes (require auth and store)
router.post('/subscriptions/create', authenticate, resolveStore, createStripeSubscription);

// Stripe Connect routes (supplier only)
router.post('/connect/create-account', authenticate, resolveStore, createConnectAccount);
router.get('/connect/account', authenticate, resolveStore, getConnectAccount);
router.post('/connect/create-onboarding-link', authenticate, resolveStore, createOnboardingLink);

// Refund routes (require auth and store)
router.post('/refunds/create', authenticate, resolveStore, createRefund);
router.get('/refunds/:orderId', authenticate, resolveStore, getOrderRefunds);

// Webhook route (NO auth, uses Stripe signature verification)
// Note: express.raw() middleware is applied in app.ts for this route
router.post('/webhook', handleStripeWebhook);

export default router;

