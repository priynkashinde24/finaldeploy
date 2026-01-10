import { Router } from 'express';
import {
  getAuditLogs,
  getAuditLogById,
} from '../controllers/auditLog.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// Routes
router.get('/', getAuditLogs);
router.get('/:id', getAuditLogById);

export default router;

