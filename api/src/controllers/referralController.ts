import { Request, Response, NextFunction } from 'express';
import { Referral } from '../models/Referral';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { generateReferralCode, redeemReferral, getReferralCode, getReferralStats } from '../services/referralService';
import { z } from 'zod';

// Validation schemas
const generateReferralSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const redeemReferralSchema = z.object({
  code: z.string().min(1, 'Referral code is required'),
  userId: z.string().min(1, 'User ID is required'),
  referredEmail: z.string().email().optional(),
});

/**
 * Generate referral code
 * POST /api/referrals/generate
 */
export const generateReferral = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = generateReferralSchema.parse(req.body);
    const { userId } = validatedData;

    const code = await generateReferralCode(userId);

    sendSuccess(res, { code, userId }, 'Referral code generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Redeem referral code
 * POST /api/referrals/redeem
 */
export const redeemReferralEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = redeemReferralSchema.parse(req.body);
    const { code, userId, referredEmail } = validatedData;

    const result = await redeemReferral(code, userId, referredEmail);

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

/**
 * Get referral code for user
 * GET /api/referrals/user/:userId
 */
export const getUserReferralCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const code = await getReferralCode(userId);

    if (!code) {
      sendError(res, 'No referral code found for this user', 404);
      return;
    }

    sendSuccess(res, { code, userId }, 'Referral code retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get referral statistics
 * GET /api/referrals/stats/:userId
 */
export const getReferralStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const stats = await getReferralStats(userId);

    sendSuccess(res, stats, 'Referral statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all referrals (admin)
 * GET /api/referrals
 */
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

