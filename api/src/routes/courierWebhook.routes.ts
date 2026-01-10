import { Router } from 'express';
import {
  handleCourierWebhook,
  handleShiprocketWebhook,
  handleDelhiveryWebhook,
} from '../controllers/courierWebhook.controller';

const router = Router();

// Generic courier webhook (requires courierId)
router.post('/courier/:courierId', handleCourierWebhook);

// Provider-specific webhooks
router.post('/courier/shiprocket', handleShiprocketWebhook);
router.post('/courier/delhivery', handleDelhiveryWebhook);

export default router;

