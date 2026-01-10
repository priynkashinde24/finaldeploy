import { Request, Response, NextFunction } from 'express';
import { eventStreamEmitter } from './eventController';
import { metricsEventEmitter } from '../services/metricsService';

/**
 * Server-Sent Events stream for real-time updates
 * GET /api/events/stream?storeId=<id>
 */
export const streamEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      res.status(400).json({ success: false, message: 'storeId is required' });
      return;
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', storeId })}\n\n`);

    // Event handler for events
    const onEvent = (event: any) => {
      if (!storeId || event.storeId === storeId) {
        res.write(`data: ${JSON.stringify({ type: 'event', data: event })}\n\n`);
      }
    };

    // Event handler for metrics
    const onMetric = (metric: any) => {
      if (!storeId || metric.storeId === storeId) {
        res.write(`data: ${JSON.stringify({ type: 'metric', data: metric })}\n\n`);
      }
    };

    // Subscribe to events
    eventStreamEmitter.on('event', onEvent);
    metricsEventEmitter.on('metric', onMetric);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      eventStreamEmitter.removeListener('event', onEvent);
      metricsEventEmitter.removeListener('metric', onMetric);
      clearInterval(heartbeat);
      res.end();
    });
  } catch (error) {
    next(error);
  }
};

