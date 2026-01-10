import { Request, Response, NextFunction } from 'express';
import { Event } from '../models/Event';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { recordMetric, metricsEventEmitter } from '../services/metricsService';
import { z } from 'zod';
import { EventEmitter } from 'events';

// Event emitter for real-time event streaming
export const eventStreamEmitter = new EventEmitter();

// Validation schema
const createEventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  payload: z.record(z.any()),
  storeId: z.string().optional(),
  userId: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
});

/**
 * Create event and derive metrics
 * POST /api/events
 */
export const createEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = createEventSchema.parse(req.body);
    const { eventType, payload, storeId, userId, occurredAt } = validatedData;

    // Create event record
    const event = new Event({
      eventType,
      payload,
      storeId,
      userId,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    });

    await event.save();

    // Emit to event stream for SSE
    eventStreamEmitter.emit('event', {
      eventType,
      payload,
      storeId,
      userId,
      occurredAt: event.occurredAt,
    });

    // Derive metrics for key events
    if (storeId) {
      await deriveMetricsFromEvent(eventType, payload, storeId);
    }

    sendSuccess(res, { eventId: event._id, eventType }, 'Event created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Derive metrics from key events
 */
const deriveMetricsFromEvent = async (
  eventType: string,
  payload: Record<string, any>,
  storeId: string
): Promise<void> => {
  try {
    switch (eventType) {
      case 'order.created':
        // Increment order count
        await recordMetric(storeId, 'orders.count', 1, { status: 'created' });
        // Record order value
        if (payload.totalAmount) {
          await recordMetric(storeId, 'orders.revenue', payload.totalAmount, { status: 'created' });
        }
        break;

      case 'order.paid':
        // Increment paid order count
        await recordMetric(storeId, 'orders.count', 1, { status: 'paid' });
        // Record revenue
        if (payload.finalAmount || payload.totalAmount) {
          const amount = payload.finalAmount || payload.totalAmount;
          await recordMetric(storeId, 'orders.revenue', amount, { status: 'paid' });
        }
        break;

      case 'cart.abandoned':
        // Increment abandoned cart count
        await recordMetric(storeId, 'carts.abandoned', 1);
        // Record abandoned cart value
        if (payload.cartValue) {
          await recordMetric(storeId, 'carts.abandoned_value', payload.cartValue);
        }
        break;

      case 'cart.viewed':
        // Increment cart view count
        await recordMetric(storeId, 'carts.viewed', 1);
        break;

      case 'product.viewed':
        // Increment product view count
        await recordMetric(storeId, 'products.viewed', 1, {
          productId: payload.productId || 'unknown',
        });
        break;

      case 'checkout.started':
        // Increment checkout started count
        await recordMetric(storeId, 'checkouts.started', 1);
        break;

      default:
        // Unknown event type, no metrics derived
        break;
    }
  } catch (error) {
    console.error('[METRICS] Error deriving metrics from event:', error);
    // Don't throw - metrics derivation shouldn't fail event creation
  }
};

