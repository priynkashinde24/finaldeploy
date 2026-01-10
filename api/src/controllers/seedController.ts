import { Request, Response, NextFunction } from 'express';
import { Event } from '../models/Event';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { eventStreamEmitter } from './eventController';
import { recordMetric } from '../services/metricsService';
import { z } from 'zod';

const seedEventsSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  count: z.number().int().min(1).max(100).optional().default(5),
});

/**
 * Seed test events for analytics
 * POST /api/analytics/seed
 */
export const seedEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = seedEventsSchema.parse(req.body);
    const { storeId, count } = validatedData;

    const events = [];

    for (let i = 0; i < count; i++) {
      const orderAmount = Math.random() * 100 + 20; // $20-$120
      const occurredAt = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000); // Random time in last 24h

      // Create order.created event
      const orderCreatedEvent = new Event({
        eventType: 'order.created',
        payload: {
          orderId: `order_test_${Date.now()}_${i}`,
          totalAmount: orderAmount,
          finalAmount: orderAmount,
          itemCount: Math.floor(Math.random() * 3) + 1,
        },
        storeId,
        occurredAt,
      });

      await orderCreatedEvent.save();

      // Emit to stream
      eventStreamEmitter.emit('event', {
        eventType: 'order.created',
        payload: orderCreatedEvent.payload,
        storeId,
        occurredAt: orderCreatedEvent.occurredAt,
      });

      // Derive metrics
      await recordMetric(storeId, 'orders.count', 1, { status: 'created' }, occurredAt);
      await recordMetric(storeId, 'orders.revenue', orderAmount, { status: 'created' }, occurredAt);

      // Some orders get paid
      if (Math.random() > 0.3) {
        // 70% conversion rate
        const paidEvent = new Event({
          eventType: 'order.paid',
          payload: {
            orderId: orderCreatedEvent.payload.orderId,
            totalAmount: orderAmount,
            finalAmount: orderAmount,
          },
          storeId,
          occurredAt: new Date(occurredAt.getTime() + Math.random() * 60000), // Paid within 1 minute
        });

        await paidEvent.save();

        eventStreamEmitter.emit('event', {
          eventType: 'order.paid',
          payload: paidEvent.payload,
          storeId,
          occurredAt: paidEvent.occurredAt,
        });

        await recordMetric(storeId, 'orders.count', 1, { status: 'paid' }, paidEvent.occurredAt);
        await recordMetric(storeId, 'orders.revenue', orderAmount, { status: 'paid' }, paidEvent.occurredAt);
      }

      events.push({
        eventType: orderCreatedEvent.eventType,
        orderId: orderCreatedEvent.payload.orderId,
        amount: orderAmount,
      });
    }

    sendSuccess(
      res,
      {
        storeId,
        eventsCreated: events.length,
        events,
      },
      `Successfully seeded ${events.length} test events`,
      201
    );
  } catch (error) {
    next(error);
  }
};

