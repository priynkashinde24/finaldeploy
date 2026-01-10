import mongoose from 'mongoose';
import { FunnelEvent, FunnelEventType } from '../models/FunnelEvent';

/**
 * Funnel Event Logger Utility
 * 
 * PURPOSE:
 * - Log conversion funnel events consistently
 * - Ensure events are logged once per session + entity
 * - Support both authenticated and guest users
 * 
 * RULES:
 * - Events are immutable
 * - One event per session + entity combination
 * - Never throws errors (logging failure shouldn't break user flow)
 */

export interface LogFunnelEventParams {
  storeId: mongoose.Types.ObjectId | string;
  sessionId: string;
  userId?: mongoose.Types.ObjectId | string | null;
  eventType: FunnelEventType;
  entityId?: mongoose.Types.ObjectId | string | null;
  metadata?: Record<string, any>;
}

/**
 * Log a funnel event
 * Never throws errors - event logging failure must not block user flow
 */
export async function logFunnelEvent(params: LogFunnelEventParams): Promise<void> {
  try {
    const { storeId, sessionId, userId, eventType, entityId, metadata } = params;

    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

    // Check if event already exists (idempotency - one event per session + entity)
    const existing = await FunnelEvent.findOne({
      storeId: storeObjId,
      sessionId,
      eventType,
      entityId: entityId || null,
    }).lean();

    if (existing) {
      // Event already logged, skip
      return;
    }

    // Create event
    await FunnelEvent.create({
      storeId: storeObjId,
      sessionId,
      userId: userId || null,
      eventType,
      entityId: entityId || null,
      metadata: metadata || {},
    });
  } catch (error) {
    // Never throw - event logging failure should not break the application
    console.error('[FUNNEL EVENT LOGGER] Error logging funnel event:', error);
  }
}

