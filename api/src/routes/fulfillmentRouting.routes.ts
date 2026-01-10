import { Router } from 'express';
import {
  routeFulfillmentController,
  getFulfillmentRouteController,
  confirmFulfillmentRouteController,
  listFulfillmentRoutesController,
} from '../controllers/fulfillmentRouting.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(resolveStore);

// POST /fulfillment-routing/route - Route fulfillment
router.post('/route', routeFulfillmentController);

// GET /fulfillment-routing/:routeType/:referenceId - Get fulfillment route
router.get('/:routeType/:referenceId', getFulfillmentRouteController);

// POST /fulfillment-routing/:routeId/confirm - Confirm fulfillment route
router.post('/:routeId/confirm', confirmFulfillmentRouteController);

// GET /fulfillment-routing/routes - List fulfillment routes
router.get('/routes', listFulfillmentRoutesController);

export default router;

