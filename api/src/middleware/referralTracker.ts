import { Request, Response, NextFunction } from 'express';
import { ReferralCode } from '../models/ReferralCode';
import { ReferralVisit } from '../models/ReferralVisit';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';
import crypto from 'crypto';

/**
 * Referral Tracker Middleware
 *
 * PURPOSE:
 * - Detect ?ref=CODE in query params
 * - Validate referral code
 * - Store in cookie/session
 * - Log referral visit
 * - Prevent overwriting existing referral
 *
 * RULES:
 * - Do NOT overwrite existing referral
 * - Only track active, non-expired codes
 * - Cookie expires in 30 days
 */

const REFERRAL_COOKIE_NAME = 'referral_code';
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * Generate visitor ID from request
 */
function generateVisitorId(req: Request): string {
  // Try to get existing visitor ID from cookie
  const existingVisitorId = req.cookies?.visitor_id;

  if (existingVisitorId) {
    return existingVisitorId;
  }

  // Generate new visitor ID
  const visitorId = crypto.randomBytes(16).toString('hex');
  return visitorId;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Referral tracking middleware
 */
export const referralTracker = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const referralCodeParam = req.query.ref as string;

    // STEP 1: Check if referral code in query params
    if (!referralCodeParam || !storeId) {
      return next(); // No referral code, continue
    }

    const code = referralCodeParam.trim().toUpperCase();

    // STEP 2: Check if referral already exists in cookie (don't overwrite)
    const existingReferral = req.cookies?.[REFERRAL_COOKIE_NAME];
    if (existingReferral && existingReferral === code) {
      return next(); // Same referral, no need to re-track
    }

    if (existingReferral && existingReferral !== code) {
      // Different referral code - don't overwrite (first referral wins)
      return next();
    }

    // STEP 3: Validate referral code
    const referralCode = await ReferralCode.findOne({
      storeId: new (await import('mongoose')).Types.ObjectId(storeId),
      code,
      status: 'active',
    }).lean();

    if (!referralCode) {
      // Invalid or disabled code - silently continue
      return next();
    }

    // STEP 4: Check if code expired
    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return next(); // Expired code
    }

    // STEP 5: Check usage limit
    if (referralCode.usageLimit && referralCode.usageCount >= referralCode.usageLimit) {
      return next(); // Usage limit reached
    }

    // STEP 6: Generate/get visitor ID
    const visitorId = generateVisitorId(req);

    // STEP 7: Check for existing visit (prevent duplicate tracking)
    const existingVisit = await ReferralVisit.findOne({
      visitorId,
      referralCode: code,
    }).lean();

    if (existingVisit) {
      // Visit already tracked, just set cookie
      res.cookie(REFERRAL_COOKIE_NAME, code, {
        maxAge: REFERRAL_COOKIE_MAX_AGE,
        httpOnly: false, // Allow JavaScript access for frontend
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      // Set visitor ID cookie if not exists
      if (!req.cookies?.visitor_id) {
        res.cookie('visitor_id', visitorId, {
          maxAge: REFERRAL_COOKIE_MAX_AGE,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
      }

      return next();
    }

    // STEP 8: Fraud detection
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const { checkReferralFraud } = await import('../utils/referralFraudDetection');
    const fraudCheck = await checkReferralFraud({
      referralCode: code,
      userId: undefined, // Not available at visit time
      ip,
      visitorId,
      storeId: new (await import('mongoose')).Types.ObjectId(storeId),
    });

    // STEP 9: Log referral visit
    const visit = new ReferralVisit({
      storeId: new (await import('mongoose')).Types.ObjectId(storeId),
      referralCode: code,
      visitorId,
      ip,
      userAgent,
      landedAt: new Date(),
      isFraud: fraudCheck.isFraud,
      fraudReason: fraudCheck.reason,
    });

    await visit.save();

    // If fraud detected, don't set cookie or increment usage
    if (fraudCheck.isFraud) {
      console.warn(`[REFERRAL TRACKER] Fraud detected: ${fraudCheck.reason}`);
      return next(); // Continue without setting cookie
    }

    // STEP 9: Set referral cookie
    res.cookie(REFERRAL_COOKIE_NAME, code, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      httpOnly: false, // Allow JavaScript access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    // Set visitor ID cookie
    if (!req.cookies?.visitor_id) {
      res.cookie('visitor_id', visitorId, {
        maxAge: REFERRAL_COOKIE_MAX_AGE,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    // STEP 10: Increment usage count (if not fraud)
    await ReferralCode.updateOne(
      { _id: referralCode._id },
      { $inc: { usageCount: 1 } }
    );

    // STEP 11: Audit log
    await logAudit({
      storeId: storeId.toString(),
      actorRole: 'system',
      action: 'REFERRAL_VISIT_RECORDED',
      entityType: 'ReferralVisit',
      entityId: visit._id.toString(),
      description: `Referral visit recorded: ${code}`,
      metadata: {
        referralCode: code,
        visitorId,
        ip,
        ownerType: referralCode.ownerType,
        ownerId: referralCode.ownerId.toString(),
      },
    });

    // STEP 12: Emit event
    eventStreamEmitter.emit('event', {
      eventType: 'REFERRAL_VISIT_RECORDED',
      payload: {
        referralCode: code,
        visitorId,
        visitId: visit._id.toString(),
      },
      storeId: storeId.toString(),
      occurredAt: new Date(),
    });

    next();
  } catch (error: any) {
    // Don't block request on referral tracking errors
    console.error('[REFERRAL TRACKER] Error:', error);
    next();
  }
};

