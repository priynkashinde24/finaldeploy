import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createIPRule,
  listIPRules,
  updateIPRule,
  disableIPRule,
} from '../controllers/adminIPRestriction.controller';

const router = Router();

// Admin only
router.use(authenticate);
router.use(authorize(['admin']));

router.post('/ip-rules', createIPRule);
router.get('/ip-rules', listIPRules);
router.patch('/ip-rules/:id', updateIPRule);
router.patch('/ip-rules/:id/disable', disableIPRule);

export default router;


