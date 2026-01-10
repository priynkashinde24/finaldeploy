import { Router } from 'express';
import {
  getComplianceSummary,
  getComplianceViolations,
  getComplianceTrends,
} from '../controllers/adminCompliance.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /admin/pricing-compliance/summary - Get compliance summary
router.get('/summary', getComplianceSummary);

// GET /admin/pricing-compliance/violations - Get violations list
router.get('/violations', getComplianceViolations);

// GET /admin/pricing-compliance/trends - Get trend analytics
router.get('/trends', getComplianceTrends);

export default router;

