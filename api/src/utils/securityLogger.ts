import { Request } from 'express';
import mongoose from 'mongoose';
import { SecurityEvent, SecurityEventType } from '../models/SecurityEvent';
import { logAudit } from './auditLogger';

export interface SecurityLogParams {
  req?: Request;
  eventType: SecurityEventType;
  severity: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

export const logSecurityEvent = async (params: SecurityLogParams): Promise<void> => {
  try {
    const { req, eventType, severity, metadata = {} } = params;

    // Extract IP and UA
    let ipAddress = 'unknown';
    let userAgent = 'unknown';
    let endpoint = req?.originalUrl || '';

    if (req) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];

      if (forwardedFor) {
        ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim() || 'unknown';
      } else if (realIp) {
        ipAddress = Array.isArray(realIp) ? realIp[0] : realIp;
      } else {
        ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      }

      userAgent = req.headers['user-agent'] || 'unknown';
    }

    const storeId =
      (req?.store?.storeId && mongoose.Types.ObjectId.isValid(req.store.storeId)
        ? new mongoose.Types.ObjectId(req.store.storeId)
        : null) ?? null;
    const userId =
      (req?.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)
        ? new mongoose.Types.ObjectId(req.user.id)
        : null) ?? null;

    // Create security event
    const event = await SecurityEvent.create({
      storeId,
      userId,
      eventType,
      ipAddress,
      userAgent,
      endpoint,
      metadata,
      severity,
    });

    // Also log to audit trail for cross-reference
    await logAudit({
      req,
      action: eventType,
      entityType: 'SecurityEvent',
      entityId: event._id.toString(),
      description: `Security event: ${eventType}`,
      metadata: {
        severity,
        ipAddress,
        ...metadata,
      },
    });
  } catch (error) {
    console.error('[SECURITY LOGGER] Failed to log security event:', error);
  }
};


