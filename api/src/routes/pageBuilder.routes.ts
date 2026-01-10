import { Router } from 'express';
import {
  createPage,
  getPages,
  getPageBySlug,
  updatePage,
  publishPage,
  deletePage,
  getPageVersions,
  rollbackPage,
} from '../controllers/pageBuilder.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and store context (via resolveStore middleware)
router.post('/', authenticate, createPage);
router.get('/', authenticate, getPages);
router.get('/:slug', getPageBySlug); // Public route for storefront, but can include ?draft=true for authenticated users
router.patch('/:id', authenticate, updatePage);
router.post('/:id/publish', authenticate, publishPage);
router.get('/:id/versions', authenticate, getPageVersions);
router.post('/:id/rollback', authenticate, rollbackPage);
router.delete('/:id', authenticate, deletePage);

export default router;

