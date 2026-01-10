import { Referral, IReferral } from '../models/Referral';

/**
 * Generate a unique referral code for a user
 */
export const generateReferralCode = async (userId: string): Promise<string> => {
  // Check if user already has an active referral code
  const existingReferral = await Referral.findOne({
    referrerUserId: userId,
    status: 'active',
  });

  if (existingReferral) {
    return existingReferral.code;
  }

  // Generate new code: REF + random alphanumeric
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    code = `REF${randomPart}`;

    const existing = await Referral.findOne({ code });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique referral code');
  }

  // Create referral record
  const referralId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const referral = new Referral({
    referralId,
    code: code!,
    referrerUserId: userId,
    reward: {
      type: 'credit', // Default reward type
      value: 10, // Default reward value ($10 credit)
    },
    status: 'active',
  });

  await referral.save();

  return code!;
};

/**
 * Redeem a referral code
 */
export const redeemReferral = async (
  code: string,
  newUserId: string,
  referredEmail?: string
): Promise<{
  success: boolean;
  referrerReward?: { type: string; value: number };
  referredReward?: { type: string; value: number };
  referral?: IReferral;
  reason?: string;
}> => {
  // Find referral code
  const referral = await Referral.findOne({
    code: code.toUpperCase(),
    status: 'active',
  });

  if (!referral) {
    return {
      success: false,
      reason: 'Referral code not found or already used',
    };
  }

  // Check if user is trying to use their own referral code
  if (referral.referrerUserId === newUserId) {
    return {
      success: false,
      reason: 'You cannot use your own referral code',
    };
  }

  // Check if code was already used by this user
  if (referral.usedByUserId === newUserId) {
    return {
      success: false,
      reason: 'You have already used this referral code',
    };
  }

  // Mark referral as used
  referral.usedByUserId = newUserId;
  referral.status = 'used';
  if (referredEmail) {
    referral.referredEmail = referredEmail.toLowerCase();
  }

  await referral.save();

  // Return rewards (in production, these would be applied to user accounts)
  return {
    success: true,
    referrerReward: referral.reward, // Reward for the person who referred
    referredReward: {
      // Reward for the new user (could be different)
      type: 'credit',
      value: 5, // $5 credit for new user
    },
    referral,
  };
};

/**
 * Get referral code for a user
 */
export const getReferralCode = async (userId: string): Promise<string | null> => {
  const referral = await Referral.findOne({
    referrerUserId: userId,
    status: 'active',
  });

  return referral ? referral.code : null;
};

/**
 * Get referral statistics for a user
 */
export const getReferralStats = async (userId: string): Promise<{
  totalReferrals: number;
  activeCode: string | null;
}> => {
  const activeCode = await getReferralCode(userId);

  const totalReferrals = await Referral.countDocuments({
    referrerUserId: userId,
    status: 'used',
  });

  return {
    totalReferrals,
    activeCode,
  };
};

