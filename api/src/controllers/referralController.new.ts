import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { ReferralCode } from '../models/ReferralCode';
import { ReferralVisit } from '../models/ReferralVisit';
import { ReferralReward } from '../models/ReferralReward';
import { UserReferral } from '../models/UserReferral';
import { ReferralRewardRule } from '../models/ReferralRewardRule';
import { Referral } from '../models/Referral';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import { checkReferralFraud } from '../utils/referralFraudDetection';
import { generateReferralCode as generateLegacyCode, redeemReferral, getReferralCode, getReferralStats as getLegacyReferralStats } from '../services/referralService';
import mongoose from 'mongoose';
import { z } from 'zod';
import crypto from 'crypto';

/**
 * Referral Controller (Enhanced)
 *
 * PURPOSE:
 * - Generate referral codes
 * - Get referral stats
 * - Admin management
 * - Fraud detection
 */

const generateReferralCodeSchema = z.object({
  ownerType: z.enum(['customer', 'reseller', 'influencer']),
  description: z.string().optional(),
  usageLimit: z.number().min(1).optional(),
  expiresAt: z.string().optional(), // ISO date string
});

/**
 * Generate unique referral code
 */
function generateUniqueCode(): string {
  // Generate 8-character alphanumeric code
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * POST /api/referrals/codes
 * Generate a new referral code
 */
export const generateReferralCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = generateReferralCodeSchema.parse(req.body);
    const { ownerType, description, usageLimit, expiresAt } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const ownerId = new mongoose.Types.ObjectId(currentUser.id);

    // Generate unique code
    let code: string = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = generateUniqueCode();
      const existing = await ReferralCode.findOne({ code }).lean();
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique || !code) {
      sendError(res, 'Failed to generate unique referral code', 500);
      return;
    }

    // Create referral code
    const referralCode = new ReferralCode({
      storeId: storeObjId,
      ownerType,
      ownerId,
      code: code!,
      status: 'active',
      usageLimit: usageLimit || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      description,
    });

    await referralCode.save();

    // Audit log
    await logAudit({
      storeId: storeId.toString(),
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      action: 'REFERRAL_CODE_CREATED',
      entityType: 'ReferralCode',
      entityId: referralCode._id.toString(),
      description: `Referral code created: ${code}`,
      metadata: {
        code: code,
        ownerType,
        ownerId: ownerId.toString(),
        usageLimit,
        expiresAt,
      },
    });

    // Emit event
    eventStreamEmitter.emit('event', {
      eventType: 'REFERRAL_CODE_CREATED',
      payload: {
        referralCodeId: referralCode._id.toString(),
        code: code,
        ownerType,
      },
      storeId: storeId.toString(),
      userId: currentUser.id,
      occurredAt: new Date(),
    });

    sendSuccess(
      res,
      {
        referralCode: {
          id: referralCode._id.toString(),
          code: code,
          ownerType,
          status: referralCode.status,
          usageCount: referralCode.usageCount,
          usageLimit: referralCode.usageLimit,
          expiresAt: referralCode.expiresAt,
          referralLink: `${process.env.FRONTEND_URL}?ref=${code}`,
        },
      },
      'Referral code generated successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/referrals/codes
 * Get all referral codes for current user
 */
export const getMyReferralCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const ownerId = new mongoose.Types.ObjectId(currentUser.id);

    const codes = await ReferralCode.find({
      storeId: storeObjId,
      ownerId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const codesWithLinks = codes.map((code) => ({
      id: code._id.toString(),
      code: code.code,
      ownerType: code.ownerType,
      status: code.status,
      usageCount: code.usageCount,
      usageLimit: code.usageLimit,
      expiresAt: code.expiresAt,
      description: code.description,
      referralLink: `${process.env.FRONTEND_URL}?ref=${code.code}`,
      createdAt: code.createdAt,
    }));

    sendSuccess(res, { codes: codesWithLinks }, 'Referral codes retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/referrals/stats
 * Get referral statistics for current user
 */
export const getReferralStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const ownerId = new mongoose.Types.ObjectId(currentUser.id);

    // Get all referral codes
    const codes = await ReferralCode.find({
      storeId: storeObjId,
      ownerId,
    })
      .select('code')
      .lean();

    const codeStrings = codes.map((c) => c.code);

    if (codeStrings.length === 0) {
      return sendSuccess(
        res,
        {
          clicks: 0,
          signups: 0,
          orders: 0,
          earnings: 0,
          codes: [],
        },
        'Referral statistics retrieved successfully'
      );
    }

    // Get visits (clicks)
    const clicks = await ReferralVisit.countDocuments({
      storeId: storeObjId,
      referralCode: { $in: codeStrings },
      isFraud: { $ne: true },
    });

    // Get signups
    const signups = await UserReferral.countDocuments({
      storeId: storeObjId,
      referrerId: ownerId,
    });

    // Get orders (converted visits)
    const orders = await ReferralVisit.countDocuments({
      storeId: storeObjId,
      referralCode: { $in: codeStrings },
      convertedOrderId: { $ne: null },
      isFraud: { $ne: true },
    });

    // Get earnings (sum of paid rewards)
    const earningsResult = await ReferralReward.aggregate([
      {
        $match: {
          storeId: storeObjId,
          referrerId: ownerId,
          status: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const earnings = earningsResult[0]?.total || 0;

    sendSuccess(
      res,
      {
        clicks,
        signups,
        orders,
        earnings,
        codes: codeStrings,
      },
      'Referral statistics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/referrals/codes/:id/disable
 * Disable a referral code
 */
export const disableReferralCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const codeId = req.params.id;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const ownerId = new mongoose.Types.ObjectId(currentUser.id);

    const referralCode = await ReferralCode.findOne({
      _id: codeId,
      storeId: storeObjId,
      ownerId, // Only owner can disable
    });

    if (!referralCode) {
      sendError(res, 'Referral code not found', 404);
      return;
    }

    referralCode.status = 'disabled';
    await referralCode.save();

    // Audit log
    await logAudit({
      storeId: storeId.toString(),
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      action: 'REFERRAL_CODE_DISABLED',
      entityType: 'ReferralCode',
      entityId: referralCode._id.toString(),
      description: `Referral code disabled: ${referralCode.code}`,
      metadata: {
        code: referralCode.code,
      },
    });

    sendSuccess(res, { code: referralCode.code }, 'Referral code disabled successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/referrals/admin/codes
 * Get all referral codes (admin only)
 */
export const getAllReferralCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const codes = await ReferralCode.find({ storeId: storeObjId })
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { codes }, 'Referral codes retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// Legacy functions for backward compatibility
export const generateReferral = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const code = await generateLegacyCode(currentUser.id);
    sendSuccess(res, { code, userId: currentUser.id }, 'Referral code generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const redeemReferralEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const { code, referredEmail } = req.body;
    if (!code) {
      sendError(res, 'Referral code is required', 400);
      return;
    }

    const result = await redeemReferral(code, currentUser.id, referredEmail);
    if (!result.success) {
      sendError(res, result.reason || 'Failed to redeem referral code', 400);
      return;
    }

    sendSuccess(
      res,
      {
        referrerReward: result.referrerReward,
        referredReward: result.referredReward,
        referral: {
          referralId: result.referral?.referralId,
          code: result.referral?.code,
        },
      },
      'Referral code redeemed successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getUserReferralCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const { userId } = req.params;
    const targetUserId = userId || currentUser?.id;

    if (!targetUserId) {
      sendError(res, 'User ID is required', 400);
      return;
    }

    const code = await getReferralCode(targetUserId);
    if (!code) {
      sendError(res, 'No referral code found for this user', 404);
      return;
    }

    sendSuccess(res, { code, userId: targetUserId }, 'Referral code retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getReferralStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const { userId } = req.params;
    const targetUserId = userId || currentUser?.id;

    if (!targetUserId) {
      sendError(res, 'User ID is required', 400);
      return;
    }

    const stats = await getLegacyReferralStats(targetUserId);
    sendSuccess(res, stats as any, 'Referral statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getAllReferrals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { referrerUserId, status } = req.query;
    const filter: any = {};
    if (referrerUserId) filter.referrerUserId = referrerUserId;
    if (status) filter.status = status;

    const referrals = await Referral.find(filter).sort({ createdAt: -1 }).limit(1000);
    sendSuccess(res, referrals, 'Referrals retrieved successfully');
  } catch (error) {
    next(error);
  }
};

