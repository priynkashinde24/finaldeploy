import { Router } from 'express';
import { getAnalyticsSummary, getTimeseries } from '../controllers/analyticsController';
import { seedEvents } from '../controllers/seedController';

const router = Router();

// POST /api/analytics/seed - Seed test events
router.post('/seed', seedEvents);

// GET /api/analytics/:storeId/summary - Get analytics summary
router.get('/:storeId/summary', getAnalyticsSummary);

// GET /api/analytics/:storeId/timeseries - Get timeseries data
router.get('/:storeId/timeseries', getTimeseries);

export default router;

