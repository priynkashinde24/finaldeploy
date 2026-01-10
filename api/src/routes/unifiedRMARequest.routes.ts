import { Router } from 'express';
import {
  createRMARequestController,
  getRMARequestController,
  listRMARequestsController,
} from '../controllers/unifiedRMARequest.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(resolveStore);

// POST /rma-requests - Create RMA request
router.post('/', createRMARequestController);

// GET /rma-requests/:rmaType/:referenceId - Get RMA request
router.get('/:rmaType/:referenceId', getRMARequestController);

// GET /rma-requests - List RMA requests
router.get('/', listRMARequestsController);

export default router;

