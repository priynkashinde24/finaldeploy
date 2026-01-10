import { Router } from 'express';
import { resolveStore } from '../middleware/resolveStore';
import { recordMarketingTouch } from '../controllers/marketingTracking.controller';

const router = Router();

/**
 * Marketing Tracking Routes
 * 
 * Note: Tracking endpoint does NOT require authentication (public)
 * But requires store resolution
 */

// POST /tracking/marketing-touch - Record marketing touch (public endpoint)
router.post('/tracking/marketing-touch', resolveStore, recordMarketingTouch);

export default router;

