import { Router } from 'express';
import {
  createThrottleRule,
  listThrottleRules,
  getThrottleRule,
  updateThrottleRule,
  deleteThrottleRule,
  getThrottlingStats,
  getThrottlingLogs,
} from '../controllers/throttling.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/throttling/rules - Create throttling rule
router.post('/rules', createThrottleRule);

// GET /admin/throttling/rules - List throttling rules
router.get('/rules', listThrottleRules);

// GET /admin/throttling/rules/:ruleId - Get rule details
router.get('/rules/:ruleId', getThrottleRule);

// PUT /admin/throttling/rules/:ruleId - Update rule
router.put('/rules/:ruleId', updateThrottleRule);

// DELETE /admin/throttling/rules/:ruleId - Delete rule
router.delete('/rules/:ruleId', deleteThrottleRule);

// GET /admin/throttling/stats - Get statistics
router.get('/stats', getThrottlingStats);

// GET /admin/throttling/logs - Get logs
router.get('/logs', getThrottlingLogs);

export default router;

