import { Router } from 'express';
import {
  getWebhookHealth,
  getWebhookRetries,
  retryWebhook,
} from '../controllers/webhookMonitoring.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require admin access
router.use(authenticate);
router.use(resolveStore);
router.use(authorize(['admin']));

router.get('/health', getWebhookHealth);
router.get('/retries', getWebhookRetries);
router.post('/retries/:id/retry', retryWebhook);

export default router;

