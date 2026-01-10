import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listSecurityEvents } from '../controllers/adminSecurity.controller';

const router = Router();

router.use(authenticate);
router.use(authorize(['admin']));

router.get('/security-events', listSecurityEvents);

export default router;


