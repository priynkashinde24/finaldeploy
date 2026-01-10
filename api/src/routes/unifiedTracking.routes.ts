import { Router } from 'express';
import {
  trackLogistics,
  trackReturns,
  trackCRM,
  createEvent,
  listEvents,
} from '../controllers/unifiedTracking.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// Public tracking routes (no auth required, but may need email/phone verification)
router.get('/logistics/:orderNumber', trackLogistics);
router.get('/returns/:rmaNumber', trackReturns);
router.get('/crm/:ticketId', trackCRM);

// Admin routes (require authentication)
router.use(authenticate);
router.use(resolveStore);

// POST /tracking/events - Create tracking event
router.post('/events', createEvent);

// GET /tracking/events - List tracking events
router.get('/events', listEvents);

export default router;

