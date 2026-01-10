import { Router } from 'express';
import {
  sendVerification,
  verifyEmail,
} from '../controllers/emailVerification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/verify-email', verifyEmail);
router.post('/send-verification', sendVerification); // Can be used with or without authentication

export default router;

