import { Router } from 'express';
import {
  createInvite,
  validateInvite,
  acceptInvite,
  listInvites,
} from '../controllers/invite.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { inviteAcceptRateLimiter } from '../middleware/rateLimit.auth';

const router = Router();

// Public routes
router.get('/validate', validateInvite);
router.post('/accept', inviteAcceptRateLimiter, acceptInvite);

// Admin routes (protected)
router.post('/admin', authenticate, authorize(['admin']), createInvite);
router.get('/admin', authenticate, authorize(['admin']), listInvites);

export default router;

