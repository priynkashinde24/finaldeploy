import { Router } from 'express';
import { supplierSyncWebhook, paymentIntentSuccessWebhook } from '../controllers/webhookController';

const router = Router();

// POST /api/webhooks/supplier-sync - Webhook receiver for supplier sync events
router.post('/supplier-sync', supplierSyncWebhook);

// POST /api/webhooks/payment-intent-success - Webhook receiver for payment success
router.post('/payment-intent-success', paymentIntentSuccessWebhook);

export default router;

