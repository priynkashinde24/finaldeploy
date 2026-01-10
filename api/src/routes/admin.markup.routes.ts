import { Router } from 'express';
import {
  createMarkupRule,
  getMarkupRules,
  updateMarkupRule,
  disableMarkupRule,
} from '../controllers/adminMarkup.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /admin/markup-rules - Create markup rule
router.post('/', createMarkupRule);

// GET /admin/markup-rules - List all markup rules
router.get('/', getMarkupRules);

// PATCH /admin/markup-rules/:id - Update markup rule
router.patch('/:id', updateMarkupRule);

// PATCH /admin/markup-rules/:id/disable - Disable markup rule
router.patch('/:id/disable', disableMarkupRule);

export default router;

