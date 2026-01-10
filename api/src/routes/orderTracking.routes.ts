import { Router } from 'express';
import { trackOrder, trackOrderPublic, publicTrackingLimiter } from '../controllers/orderTracking.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Authenticated tracking (requires auth)
router.get('/orders/:orderNumber/track', authenticate, trackOrder);

// Public tracking (rate limited, no auth)
router.get('/orders/:orderNumber/track/public', publicTrackingLimiter, trackOrderPublic);

export default router;

