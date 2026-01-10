import { Router } from 'express';
import { handleInboundSMS, handleSMSStatus } from '../controllers/smsWebhook.controller';

const router = Router();

/**
 * SMS Webhook Routes
 *
 * PURPOSE:
 * - Handle inbound SMS messages (opt-out)
 * - Handle delivery status updates
 *
 * NOTE:
 * - No authentication required (webhook signature verification can be added)
 * - These routes are called by SMS providers (Twilio, MSG91, AWS SNS)
 */

// POST /webhooks/sms/inbound
// Handle inbound SMS messages (STOP, START, etc.)
router.post('/inbound', handleInboundSMS);

// POST /webhooks/sms/status
// Handle delivery status updates
router.post('/status', handleSMSStatus);

export default router;

