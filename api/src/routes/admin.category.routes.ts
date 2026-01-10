import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/adminCategory.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /api/admin/categories - Create category
router.post('/', createCategory);

// GET /api/admin/categories - List categories
router.get('/', listCategories);

// GET /api/admin/categories/:id - Get category
router.get('/:id', getCategory);

// PATCH /api/admin/categories/:id - Update category
router.patch('/:id', updateCategory);

// DELETE /api/admin/categories/:id - Delete category
router.delete('/:id', deleteCategory);

export default router;

