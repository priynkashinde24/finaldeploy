import { Router } from 'express';
import {
  generateLabelController,
  getLabelController,
  listLabelsController,
} from '../controllers/labelGenerator.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /labels/generate - Generate label
router.post('/generate', resolveStore, generateLabelController);

// GET /labels/:labelType/:referenceId - Get label by reference
router.get('/:labelType/:referenceId', resolveStore, getLabelController);

// GET /labels - List labels
router.get('/', resolveStore, listLabelsController);

export default router;

