import { Router } from 'express';
import {
  getSubscriptions,
  assignPlan,
  cancelSubscription,
  extendTrial,
} from '../controllers/adminSubscription.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /admin/subscriptions - List all subscriptions
router.get('/', getSubscriptions);

// PATCH /admin/subscriptions/:id/assign-plan - Assign plan to user
router.patch('/:id/assign-plan', assignPlan);

// PATCH /admin/subscriptions/:id/cancel - Cancel subscription
router.patch('/:id/cancel', cancelSubscription);

// PATCH /admin/subscriptions/:id/extend-trial - Extend trial
router.patch('/:id/extend-trial', extendTrial);

export default router;

