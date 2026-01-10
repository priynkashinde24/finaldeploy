import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createAttribute,
  listAttributes,
  getAttribute,
  updateAttribute,
  deleteAttribute,
} from '../controllers/adminAttribute.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /api/admin/attributes - Create attribute
router.post('/', createAttribute);

// GET /api/admin/attributes - List attributes
router.get('/', listAttributes);

// GET /api/admin/attributes/:id - Get attribute
router.get('/:id', getAttribute);

// PATCH /api/admin/attributes/:id - Update attribute
router.patch('/:id', updateAttribute);

// DELETE /api/admin/attributes/:id - Delete attribute
router.delete('/:id', deleteAttribute);

export default router;

