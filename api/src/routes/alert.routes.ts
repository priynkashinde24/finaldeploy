import { Router } from 'express';
import {
  getAdminMarginAlerts,
  getResellerMarginAlerts,
  acknowledgeMarginAlert,
  resolveMarginAlert,
} from '../controllers/alert.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Admin routes
router.get('/admin/margin-alerts', authenticate, authorize(['admin']), getAdminMarginAlerts);
router.patch('/admin/margin-alerts/:id/acknowledge', authenticate, authorize(['admin']), acknowledgeMarginAlert);
router.patch('/admin/margin-alerts/:id/resolve', authenticate, authorize(['admin']), resolveMarginAlert);

// Reseller routes
router.get('/reseller/margin-alerts', authenticate, authorize(['reseller']), getResellerMarginAlerts);

export default router;

