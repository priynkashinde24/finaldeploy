import { Router } from 'express';
import {
  handleInboundWhatsApp,
  handleWhatsAppStatus,
} from '../controllers/whatsappWebhook.controller';

const router = Router();

// POST /webhooks/whatsapp/inbound - Handle inbound WhatsApp messages (opt-out)
router.post('/inbound', handleInboundWhatsApp);

// POST /webhooks/whatsapp/status - Handle delivery status updates
router.post('/status', handleWhatsAppStatus);

export default router;

