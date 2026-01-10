import mongoose from 'mongoose';
import { AttributionSession } from '../models/AttributionSession';
import { MarketingTouch } from '../models/MarketingTouch';
import { calculateAttribution } from '../utils/attributionEngine';
import { AttributionModel } from '../models/AttributionSnapshot';

/**
 * Attribution Service
 * 
 * PURPOSE:
 * - Get attribution for user signup
 * - Get attribution for order creation
 * - Create immutable attribution snapshots
 */

export interface AttributionSnapshot {
  firstTouch?: {
    touchId: mongoose.Types.ObjectId;
    channel: string;
    source?: string;
    medium?: string;
    campaign?: string;
    occurredAt: Date;
  };
  lastTouch?: {
    touchId: mongoose.Types.ObjectId;
    channel: string;
    source?: string;
    medium?: string;
    campaign?: string;
    occurredAt: Date;
  };
  signupChannel?: string;
  attributionModel: AttributionModel;
  channelCredits?: Array<{
    channel: string;
    credit: number;
    touchId: mongoose.Types.ObjectId;
  }>;
}

/**
 * Get attribution snapshot for a session
 */
export async function getAttributionSnapshot(
  sessionId: string,
  attributionModel: AttributionModel = 'last_touch'
): Promise<AttributionSnapshot | null> {
  try {
    const session = await AttributionSession.findOne({ sessionId })
      .populate('firstTouchId')
      .populate('lastTouchId')
      .populate('allTouchIds')
      .lean();

    if (!session) {
      return null;
    }

    const firstTouch = session.firstTouchId as any;
    const lastTouch = session.lastTouchId as any;
    const allTouches = (session.allTouchIds || []) as any[];

    if (!firstTouch || !lastTouch) {
      return null;
    }

    // Calculate channel credits for multi-touch models
    let channelCredits: Array<{
      channel: string;
      credit: number;
      touchId: mongoose.Types.ObjectId;
    }> = [];

    if (attributionModel === 'linear' || attributionModel === 'time_decay') {
      const credits = await calculateAttribution(sessionId, attributionModel);
      channelCredits = credits.map((c) => ({
        channel: c.channel,
        credit: c.credit,
        touchId: c.touchId,
      }));
    } else {
      // Single-touch models
      const touch = attributionModel === 'first_touch' ? firstTouch : lastTouch;
      channelCredits = [
        {
          channel: touch.channel,
          credit: 1.0,
          touchId: touch._id,
        },
      ];
    }

    return {
      firstTouch: {
        touchId: firstTouch._id,
        channel: firstTouch.channel,
        source: firstTouch.source,
        medium: firstTouch.medium,
        campaign: firstTouch.campaign,
        occurredAt: firstTouch.occurredAt,
      },
      lastTouch: {
        touchId: lastTouch._id,
        channel: lastTouch.channel,
        source: lastTouch.source,
        medium: lastTouch.medium,
        campaign: lastTouch.campaign,
        occurredAt: lastTouch.occurredAt,
      },
      signupChannel: firstTouch.channel, // First touch is signup channel
      attributionModel,
      channelCredits,
    };
  } catch (error: any) {
    console.error('[ATTRIBUTION SERVICE] Error getting attribution snapshot:', error);
    return null;
  }
}

/**
 * Get attribution snapshot for a user (from their signup session)
 */
export async function getUserAttributionSnapshot(
  userId: mongoose.Types.ObjectId | string,
  attributionModel: AttributionModel = 'last_touch'
): Promise<AttributionSnapshot | null> {
  try {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Find the most recent session for this user
    const session = await AttributionSession.findOne({
      userId: userObjId,
    })
      .sort({ startedAt: -1 })
      .lean();

    if (!session) {
      return null;
    }

    return await getAttributionSnapshot(session.sessionId, attributionModel);
  } catch (error: any) {
    console.error('[ATTRIBUTION SERVICE] Error getting user attribution:', error);
    return null;
  }
}

/**
 * Get attribution snapshot from request (session cookie)
 */
export async function getAttributionFromRequest(
  req: any,
  attributionModel: AttributionModel = 'last_touch'
): Promise<AttributionSnapshot | null> {
  try {
    // Try to get session ID from cookie or request
    const sessionId = req.cookies?.mk_session || req.body?.sessionId || req.query?.sessionId;

    if (!sessionId) {
      return null;
    }

    // Parse session ID if it's JSON
    let actualSessionId = sessionId;
    try {
      const parsed = JSON.parse(sessionId);
      if (parsed.sessionId) {
        actualSessionId = parsed.sessionId;
      }
    } catch {
      // Not JSON, use as-is
    }

    return await getAttributionSnapshot(actualSessionId, attributionModel);
  } catch (error: any) {
    console.error('[ATTRIBUTION SERVICE] Error getting attribution from request:', error);
    return null;
  }
}

