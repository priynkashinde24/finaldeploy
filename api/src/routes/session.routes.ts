import { Router } from 'express';
import {
  getMySessions,
  revokeSessionEndpoint,
  revokeAllSessionsEndpoint,
  getUserSessions,
  adminRevokeSession,
} from '../controllers/session.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// User routes (authenticated)
router.get('/me', authenticate, getMySessions);
router.post('/revoke', authenticate, revokeSessionEndpoint);
router.post('/revoke-all', authenticate, revokeAllSessionsEndpoint);

// Admin routes
router.get('/admin/:userId', authenticate, authorize(['admin']), getUserSessions);
router.post('/admin/:refreshTokenId/revoke', authenticate, authorize(['admin']), adminRevokeSession);

export default router;

