import { Router } from 'express';
import { getProfile, updateProfile, changePassword } from '../controllers/userProfile.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);

export default router;

