import { Router } from 'express';
import { createEvent } from '../controllers/eventController';
import { streamEvents } from '../controllers/streamController';

const router = Router();

// POST /api/events - Create event
router.post('/', createEvent);

// GET /api/events/stream - Server-Sent Events stream
router.get('/stream', streamEvents);

export default router;

