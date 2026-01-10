import { ReferralVisit } from '../models/ReferralVisit';
import { ReferralCode } from '../models/ReferralCode';
import mongoose from 'mongoose';

/**
 * Referral Fraud Detection Utilities
 *
 * PURPOSE:
 * - Detect self-referral attempts
 * - Detect same IP abuse
 * - Detect device fingerprint abuse
 * - Rate-limit referral visits
 * - Block suspicious codes
 */

export interface FraudCheckResult {
  isFraud: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Check for self-referral
 */
export async function checkSelfReferral(
  referralCode: string,
  userId: mongoose.Types.ObjectId | string
): Promise<FraudCheckResult> {
  const code = await ReferralCode.findOne({ code: referralCode.toUpperCase() }).lean();
  
  if (!code) {
    return { isFraud: false, severity: 'low' };
  }

  const referrerId = typeof code.ownerId === 'string' ? code.ownerId : code.ownerId.toString();
  const userIdStr = typeof userId === 'string' ? userId : userId.toString();

  if (referrerId === userIdStr) {
    return {
      isFraud: true,
      reason: 'Self-referral detected',
      severity: 'high',
    };
  }

  return { isFraud: false, severity: 'low' };
}

/**
 * Check for same IP abuse
 */
export async function checkSameIpAbuse(
  referralCode: string,
  ip: string,
  storeId: mongoose.Types.ObjectId | string,
  maxVisitsPerIp: number = 10
): Promise<FraudCheckResult> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const recentVisits = await ReferralVisit.countDocuments({
    storeId: storeObjId,
    referralCode: referralCode.toUpperCase(),
    ip,
    landedAt: {
      $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    },
  });

  if (recentVisits >= maxVisitsPerIp) {
    return {
      isFraud: true,
      reason: `Too many visits from same IP (${recentVisits} in 24h)`,
      severity: 'medium',
    };
  }

  return { isFraud: false, severity: 'low' };
}

/**
 * Check for device fingerprint abuse (same visitorId)
 */
export async function checkDeviceFingerprintAbuse(
  referralCode: string,
  visitorId: string,
  storeId: mongoose.Types.ObjectId | string,
  maxVisitsPerDevice: number = 5
): Promise<FraudCheckResult> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const recentVisits = await ReferralVisit.countDocuments({
    storeId: storeObjId,
    referralCode: referralCode.toUpperCase(),
    visitorId,
    landedAt: {
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    },
  });

  if (recentVisits >= maxVisitsPerDevice) {
    return {
      isFraud: true,
      reason: `Too many visits from same device (${recentVisits} in 7d)`,
      severity: 'low',
    };
  }

  return { isFraud: false, severity: 'low' };
}

/**
 * Comprehensive fraud check
 */
export async function checkReferralFraud(params: {
  referralCode: string;
  userId?: mongoose.Types.ObjectId | string;
  ip: string;
  visitorId: string;
  storeId: mongoose.Types.ObjectId | string;
}): Promise<FraudCheckResult> {
  const { referralCode, userId, ip, visitorId, storeId } = params;

  // Check self-referral (if userId provided)
  if (userId) {
    const selfReferralCheck = await checkSelfReferral(referralCode, userId);
    if (selfReferralCheck.isFraud) {
      return selfReferralCheck;
    }
  }

  // Check same IP abuse
  const ipAbuseCheck = await checkSameIpAbuse(referralCode, ip, storeId);
  if (ipAbuseCheck.isFraud) {
    return ipAbuseCheck;
  }

  // Check device fingerprint abuse
  const deviceAbuseCheck = await checkDeviceFingerprintAbuse(referralCode, visitorId, storeId);
  if (deviceAbuseCheck.isFraud) {
    return deviceAbuseCheck;
  }

  return { isFraud: false, severity: 'low' };
}

/**
 * Mark referral visit as fraud
 */
export async function markReferralVisitAsFraud(
  visitId: mongoose.Types.ObjectId | string,
  reason: string
): Promise<void> {
  await ReferralVisit.updateOne(
    { _id: visitId },
    {
      $set: {
        isFraud: true,
        fraudReason: reason,
      },
    }
  );
}

