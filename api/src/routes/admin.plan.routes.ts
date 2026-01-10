import { Router } from 'express';
import {
  createPlan,
  getPlans,
  updatePlan,
  disablePlan,
} from '../controllers/adminPlan.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/plans - Create plan
router.post('/', createPlan);

// GET /admin/plans - List all plans
router.get('/', getPlans);

// PATCH /admin/plans/:id - Update plan
router.patch('/:id', updatePlan);

// PATCH /admin/plans/:id/disable - Disable plan
router.patch('/:id/disable', disablePlan);

export default router;

