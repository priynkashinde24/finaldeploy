import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  createCryptoPayment,
  checkCryptoPaymentStatus,
  cryptoPaymentWebhook,
  confirmCryptoPayment,
} from '../controllers/cryptoPayment.controller';

const router = Router();

/**
 * Cryptocurrency Payment Routes
 */

// Create crypto payment (requires auth + store)
router.post('/payments/crypto/create', authenticate, resolveStore, createCryptoPayment);

// Check payment status (requires auth + store)
router.get('/payments/crypto/status/:paymentId', authenticate, resolveStore, checkCryptoPaymentStatus);

// Webhook for payment confirmation (public, but should verify signature in production)
router.post('/payments/crypto/webhook', cryptoPaymentWebhook);

// Manually confirm payment (for testing/admin - requires auth + store)
router.post('/payments/crypto/confirm', authenticate, resolveStore, confirmCryptoPayment);

export default router;

