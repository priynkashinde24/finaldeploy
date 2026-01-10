import { generateReferralCode, redeemReferral, getReferralCode, getReferralStats } from '../referralService';
import { Referral } from '../../models/Referral';

// Mock the model
jest.mock('../../models/Referral');

describe('Referral Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReferralCode', () => {
    it('should generate a unique referral code', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue(null); // No existing code
      (Referral.prototype.save as jest.Mock).mockResolvedValue(true);

      const code = await generateReferralCode('user_123');

      expect(code).toMatch(/^REF[A-Z0-9]+$/);
      expect(Referral).toHaveBeenCalled();
    });

    it('should return existing code if user already has one', async () => {
      const existingReferral = {
        code: 'REFEXISTING',
        status: 'active',
      };

      (Referral.findOne as jest.Mock).mockResolvedValue(existingReferral);

      const code = await generateReferralCode('user_123');

      expect(code).toBe('REFEXISTING');
      expect(Referral.prototype.save).not.toHaveBeenCalled();
    });

    it('should throw error if unable to generate unique code', async () => {
      (Referral.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // No existing code
        .mockResolvedValueOnce({ code: 'REF123' }) // First attempt exists
        .mockResolvedValueOnce({ code: 'REF456' }) // Second attempt exists
        .mockResolvedValueOnce({ code: 'REF789' }); // All attempts exist

      await expect(generateReferralCode('user_123')).rejects.toThrow(
        'Failed to generate unique referral code'
      );
    });
  });

  describe('redeemReferral', () => {
    const mockReferral = {
      referralId: 'ref_123',
      code: 'REFABC',
      referrerUserId: 'user_123',
      status: 'active',
      usedByUserId: null,
      reward: {
        type: 'credit',
        value: 10,
      },
      save: jest.fn().mockResolvedValue(true),
    };

    it('should successfully redeem referral code', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue(mockReferral);

      const result = await redeemReferral('REFABC', 'user_456', 'newuser@example.com');

      expect(result.success).toBe(true);
      expect(result.referrerReward).toEqual({ type: 'credit', value: 10 });
      expect(result.referredReward).toEqual({ type: 'credit', value: 5 });
      expect(mockReferral.save).toHaveBeenCalled();
      expect(mockReferral.usedByUserId).toBe('user_456');
      expect(mockReferral.status).toBe('used');
    });

    it('should reject if referral code not found', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue(null);

      const result = await redeemReferral('INVALID', 'user_456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Referral code not found or already used');
    });

    it('should reject if user tries to use own referral code', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue({
        ...mockReferral,
        referrerUserId: 'user_456',
      });

      const result = await redeemReferral('REFABC', 'user_456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('You cannot use your own referral code');
    });

    it('should reject if code already used by this user', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue({
        ...mockReferral,
        usedByUserId: 'user_456',
        status: 'used',
      });

      const result = await redeemReferral('REFABC', 'user_456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('You have already used this referral code');
    });

    it('should reject if referral is not active', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue({
        ...mockReferral,
        status: 'expired',
      });

      const result = await redeemReferral('REFABC', 'user_456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Referral code not found or already used');
    });
  });

  describe('getReferralCode', () => {
    it('should return referral code if exists', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue({
        code: 'REFABC',
        status: 'active',
      });

      const code = await getReferralCode('user_123');

      expect(code).toBe('REFABC');
    });

    it('should return null if no referral code exists', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue(null);

      const code = await getReferralCode('user_123');

      expect(code).toBeNull();
    });
  });

  describe('getReferralStats', () => {
    it('should return referral statistics', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue({
        code: 'REFABC',
        status: 'active',
      });
      (Referral.countDocuments as jest.Mock).mockResolvedValue(5);

      const stats = await getReferralStats('user_123');

      expect(stats.totalReferrals).toBe(5);
      expect(stats.activeCode).toBe('REFABC');
    });

    it('should return null active code if none exists', async () => {
      (Referral.findOne as jest.Mock).mockResolvedValue(null);
      (Referral.countDocuments as jest.Mock).mockResolvedValue(0);

      const stats = await getReferralStats('user_123');

      expect(stats.totalReferrals).toBe(0);
      expect(stats.activeCode).toBeNull();
    });
  });
});

