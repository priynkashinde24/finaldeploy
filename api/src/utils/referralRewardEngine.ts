import mongoose from 'mongoose';
import { ReferralRewardRule } from '../models/ReferralRewardRule';
import { ReferralReward } from '../models/ReferralReward';
import { IOrder } from '../models/Order';
import { UserReferral } from '../models/UserReferral';
import { roundPrice } from '../services/pricingService';

/**
 * Referral Reward Calculation Engine
 *
 * PURPOSE:
 * - Calculate referral rewards based on rules
 * - Enforce caps and limits
 * - Return reward snapshot
 *
 * RULES:
 * - Reward ≤ order value
 * - Respect maxRewardPerUser
 * - Respect maxRewardPerOrder
 * - Check minOrderValue
 */

export interface CalculateReferralRewardParams {
  storeId: mongoose.Types.ObjectId | string;
  order: IOrder;
  userReferral: any; // IUserReferral from models/UserReferral
}

export interface ReferralRewardCalculationResult {
  reward: number;
  rule: any; // ReferralRewardRule
  rewardSnapshot: {
    rewardType: 'flat' | 'percentage';
    rewardValue: number;
    trigger: 'signup' | 'first_order' | 'every_order';
    orderValue: number;
  };
  capped: boolean; // Whether reward was capped
  reason?: string; // If no reward, reason
}

/**
 * Calculate referral reward for an order
 */
export async function calculateReferralReward(
  params: CalculateReferralRewardParams
): Promise<ReferralRewardCalculationResult | null> {
  const { storeId, order, userReferral } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  // STEP 1: Determine trigger type
  const isFirstOrder = !userReferral.firstOrderId;
  const trigger: 'signup' | 'first_order' | 'every_order' = isFirstOrder ? 'first_order' : 'every_order';

  // STEP 2: Find applicable reward rule
  const rewardRules = await ReferralRewardRule.find({
    storeId: storeObjId,
    referrerType: userReferral.referrerType,
    trigger: { $in: [trigger, 'every_order'] }, // Can use 'every_order' for first order too
    isActive: true,
  })
    .sort({ priority: 1 }) // Lower priority = higher priority
    .lean();

  if (rewardRules.length === 0) {
    return null; // No reward rule found
  }

  // Use highest priority rule
  const rule = rewardRules[0];

  // STEP 3: Check minOrderValue
  if (rule.minOrderValue && order.grandTotal < rule.minOrderValue) {
    return {
      reward: 0,
      rule,
      rewardSnapshot: {
        rewardType: rule.rewardType,
        rewardValue: rule.rewardValue,
        trigger: rule.trigger,
        orderValue: order.grandTotal,
      },
      capped: false,
      reason: `Order value ${order.grandTotal} is below minimum ${rule.minOrderValue}`,
    };
  }

  // STEP 4: Calculate base reward
  let reward = 0;

  if (rule.rewardType === 'flat') {
    reward = rule.rewardValue;
  } else if (rule.rewardType === 'percentage') {
    reward = (order.grandTotal * rule.rewardValue) / 100;
  }

  // STEP 5: Enforce maxRewardPerOrder
  let capped = false;
  if (rule.maxRewardPerOrder && reward > rule.maxRewardPerOrder) {
    reward = rule.maxRewardPerOrder;
    capped = true;
  }

  // STEP 6: Ensure reward ≤ order value
  if (reward > order.grandTotal) {
    reward = order.grandTotal;
    capped = true;
  }

  // STEP 7: Check maxRewardPerUser (total rewards for this referrer from this user)
  if (rule.maxRewardPerUser) {
    const totalRewards = await ReferralReward.aggregate([
      {
        $match: {
          storeId: storeObjId,
          referrerId: userReferral.referrerId,
          referredUserId: userReferral.userId,
          status: { $in: ['pending', 'paid'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totalRewardSoFar = totalRewards[0]?.total || 0;
    const remainingReward = rule.maxRewardPerUser - totalRewardSoFar;

    if (remainingReward <= 0) {
      return {
        reward: 0,
        rule,
        rewardSnapshot: {
          rewardType: rule.rewardType,
          rewardValue: rule.rewardValue,
          trigger: rule.trigger,
          orderValue: order.grandTotal,
        },
        capped: false,
        reason: `Max reward per user (${rule.maxRewardPerUser}) already reached`,
      };
    }

    if (reward > remainingReward) {
      reward = remainingReward;
      capped = true;
    }
  }

  // STEP 8: Round reward
  reward = roundPrice(reward);

  return {
    reward,
    rule,
    rewardSnapshot: {
      rewardType: rule.rewardType,
      rewardValue: rule.rewardValue,
      trigger: rule.trigger,
      orderValue: order.grandTotal,
    },
    capped,
  };
}

