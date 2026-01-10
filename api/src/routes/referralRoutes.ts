import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  generateReferralCode,
  getMyReferralCodes,
  getReferralStats,
  disableReferralCode,
  getAllReferralCodes,
  // Legacy exports for backward compatibility
  generateReferral,
  redeemReferralEndpoint,
  getUserReferralCode,
  getReferralStatistics,
  getAllReferrals,
} from '../controllers/referralController.new';

const router = Router();

// New enhanced referral endpoints
// POST /api/referrals/codes - Generate a new referral code
router.post('/codes', authenticate, generateReferralCode);

// GET /api/referrals/codes - Get all referral codes for current user
router.get('/codes', authenticate, getMyReferralCodes);

// GET /api/referrals/stats - Get referral statistics for current user
router.get('/stats', authenticate, getReferralStats);

// PATCH /api/referrals/codes/:id/disable - Disable a referral code
router.patch('/codes/:id/disable', authenticate, disableReferralCode);

// GET /api/referrals/admin/codes - Get all referral codes (admin only)
router.get('/admin/codes', authenticate, authorize(['admin']), getAllReferralCodes);

// Legacy endpoints (for backward compatibility)
// POST /api/referrals/generate - Generate referral code (legacy)
router.post('/generate', authenticate, generateReferral);

// POST /api/referrals/redeem - Redeem referral code (legacy)
router.post('/redeem', authenticate, redeemReferralEndpoint);

// GET /api/referrals/user/:userId - Get referral code for user (legacy)
router.get('/user/:userId', authenticate, getUserReferralCode);

// GET /api/referrals/stats/:userId - Get referral statistics (legacy)
router.get('/stats/:userId', authenticate, getReferralStatistics);

// GET /api/referrals - Get all referrals (admin, legacy)
router.get('/', authenticate, authorize(['admin']), getAllReferrals);

export default router;
