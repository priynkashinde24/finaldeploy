import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { MarketingTouch } from '../models/MarketingTouch';
import { AttributionSession } from '../models/AttributionSession';
import { resolveChannel, extractReferrerDomain, isBotTraffic } from '../utils/attributionEngine';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import { z } from 'zod';

/**
 * Marketing Tracking Controller
 * 
 * Handles:
 * - Recording marketing touches
 * - Managing attribution sessions
 * - Preventing fraud and bot traffic
 */

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * POST /tracking/marketing-touch
 * Record a marketing touch
 */
export const recordMarketingTouch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : req.body.storeId;
    if (!storeId) {
      sendError(res, 'Store ID required', 400);
      return;
    }

    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

    // Validate request body
    const touchSchema = z.object({
      sessionId: z.string().min(1),
      channel: z.string().optional(),
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      content: z.string().optional(),
      term: z.string().optional(),
      landingPage: z.string().min(1),
      referrerUrl: z.string().optional(),
      referrerDomain: z.string().optional(),
    });

    const validated = touchSchema.parse(req.body);

    // Check for bot traffic
    const userAgent = req.headers['user-agent'];
    if (isBotTraffic(userAgent)) {
      sendSuccess(res, { recorded: false, reason: 'Bot traffic ignored' }, 'Bot traffic ignored');
      return;
    }

    // Resolve channel if not provided
    let channel = validated.channel as any;
    if (!channel) {
      const channelResult = resolveChannel({
        utmSource: validated.source,
        utmMedium: validated.medium,
        utmCampaign: validated.campaign,
        referrerUrl: validated.referrerUrl,
        referrerDomain: validated.referrerDomain,
      });
      channel = channelResult.channel;
    }

    // Extract referrer domain if not provided
    let referrerDomain = validated.referrerDomain;
    if (!referrerDomain && validated.referrerUrl) {
      referrerDomain = extractReferrerDomain(validated.referrerUrl);
    }

    // Get user ID if authenticated
    const userId = req.user?.id || req.user?.userId || null;

    // Get device info
    const deviceType = detectDeviceType(userAgent || '');

    // Create marketing touch
    const touch = await MarketingTouch.create({
      storeId: storeObjId,
      sessionId: validated.sessionId,
      userId: userId ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId) : null,
      channel,
      source: validated.source,
      medium: validated.medium,
      campaign: validated.campaign,
      content: validated.content,
      term: validated.term,
      landingPage: validated.landingPage,
      referrerUrl: validated.referrerUrl,
      referrerDomain,
      userAgent,
      ipAddress: req.ip || req.socket.remoteAddress,
      deviceType,
      occurredAt: new Date(),
    });

    // Ensure mk_session cookie is set so downstream order creation can resolve session attribution
    // Store JSON so backend attributionService can parse { sessionId }
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(
      'mk_session',
      JSON.stringify({ sessionId: validated.sessionId, expiresAt: new Date(Date.now() + SESSION_TIMEOUT_MS).toISOString() }),
      {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: SESSION_TIMEOUT_MS,
        path: '/',
      }
    );

    // Get or create attribution session
    let session: any = await AttributionSession.findOne({
      storeId: storeObjId,
      sessionId: validated.sessionId,
    }).lean();

    const now = new Date();
    if (session) {
      // Check if session expired
      const lastActivity = new Date(session.lastActivityAt);
      const timeSinceLastActivity = now.getTime() - lastActivity.getTime();

      if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
        // Session expired, create new session
        const newSession = await AttributionSession.create({
          storeId: storeObjId,
          sessionId: validated.sessionId,
          userId: userId ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId) : null,
          firstTouchId: touch._id,
          lastTouchId: touch._id,
          allTouchIds: [touch._id],
          startedAt: now,
          endedAt: now,
          lastActivityAt: now,
          touchCount: 1,
          isActive: true,
        });
        session = newSession.toObject();
      } else {
        // Update existing session
        await AttributionSession.updateOne(
          { _id: session._id },
          {
            $set: {
              lastTouchId: touch._id,
              lastActivityAt: now,
              endedAt: now,
              isActive: true,
            },
            $push: { allTouchIds: touch._id },
            $inc: { touchCount: 1 },
          }
        );
      }
    } else {
      // Create new session
      const newSession = await AttributionSession.create({
        storeId: storeObjId,
        sessionId: validated.sessionId,
        userId: userId ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId) : null,
        firstTouchId: touch._id,
        lastTouchId: touch._id,
        allTouchIds: [touch._id],
        startedAt: now,
        endedAt: now,
        lastActivityAt: now,
        touchCount: 1,
        isActive: true,
      });
      session = newSession.toObject();
    }

    // Emit event
    eventStreamEmitter.emit('event', {
      eventType: 'MARKETING_TOUCH_RECORDED',
      payload: {
        touchId: touch._id.toString(),
        storeId: storeObjId.toString(),
        sessionId: validated.sessionId,
        channel,
        source: validated.source,
        medium: validated.medium,
        campaign: validated.campaign,
      },
      timestamp: now,
    });

    // Log audit
    await logAudit({
      action: 'MARKETING_TOUCH_RECORDED',
      actorId: userId?.toString() || null,
      actorRole: (req.user?.role as 'admin' | 'supplier' | 'reseller' | 'system') || 'system',
      entityType: 'MarketingTouch',
      entityId: touch._id.toString(),
      storeId: storeObjId.toString(),
      description: `Marketing touch recorded: ${channel} channel`,
      metadata: {
        sessionId: validated.sessionId,
        channel,
        source: validated.source,
        medium: validated.medium,
      },
    });

    sendSuccess(
      res,
      { touchId: touch._id.toString(), sessionId: validated.sessionId },
      'Marketing touch recorded'
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400);
      return;
    }
    next(error);
  }
};

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | undefined {
  if (!userAgent) return undefined;

  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

