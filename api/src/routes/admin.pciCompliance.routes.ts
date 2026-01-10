import { Router } from 'express';
import {
  getComplianceStats,
  getViolations,
  getComplianceLogs,
} from '../controllers/pciCompliance.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// GET /admin/pci-compliance/stats - Get PCI compliance statistics
router.get('/stats', getComplianceStats);

// GET /admin/pci-compliance/violations - Get recent violations
router.get('/violations', getViolations);

// GET /admin/pci-compliance/logs - Get compliance logs
router.get('/logs', getComplianceLogs);

export default router;

