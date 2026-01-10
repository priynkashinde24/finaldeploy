import { validateCoupon, applyCoupon, Cart, CartItem } from '../couponService';
import { Coupon } from '../../models/Coupon';
import { CouponRedemption } from '../../models/CouponRedemption';

// Mock the models
jest.mock('../../models/Coupon');
jest.mock('../../models/CouponRedemption');

describe('Coupon Service', () => {
  const mockCart: Cart = {
    items: [
      {
        productId: 'prod_1',
        sku: 'SKU001',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
      },
    ],
    subtotal: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (CouponRedemption.countDocuments as jest.Mock).mockResolvedValue(0);
  });

  describe('applyCoupon - Percent discount', () => {
    it('should apply 10% discount correctly', () => {
      const coupon = {
        type: 'percent' as const,
        value: 10,
        conditions: {},
      } as any;

      const discount = applyCoupon(mockCart, coupon);
      expect(discount).toBe(10); // 10% of $100 = $10
    });

    it('should apply 25% discount correctly', () => {
      const coupon = {
        type: 'percent' as const,
        value: 25,
        conditions: {},
      } as any;

      const discount = applyCoupon(mockCart, coupon);
      expect(discount).toBe(25); // 25% of $100 = $25
    });
  });

  describe('applyCoupon - Fixed discount', () => {
    it('should apply fixed $5 discount', () => {
      const coupon = {
        type: 'fixed' as const,
        value: 5,
        conditions: {},
      } as any;

      const discount = applyCoupon(mockCart, coupon);
      expect(discount).toBe(5);
    });

    it('should not exceed cart subtotal', () => {
      const coupon = {
        type: 'fixed' as const,
        value: 150, // More than cart total
        conditions: {},
      } as any;

      const discount = applyCoupon(mockCart, coupon);
      expect(discount).toBe(100); // Should cap at cart subtotal
    });
  });

  describe('applyCoupon - BOGO', () => {
    it('should apply BOGO discount for matching SKU', () => {
      const cart: Cart = {
        items: [
          {
            productId: 'prod_1',
            sku: 'SKU001',
            quantity: 4, // Buy 4, get 2 free
            unitPrice: 50,
            totalPrice: 200,
          },
        ],
        subtotal: 200,
      };

      const coupon = {
        type: 'bogo' as const,
        value: 0,
        conditions: {
          productSkus: ['SKU001'],
        },
      } as any;

      const discount = applyCoupon(cart, coupon);
      expect(discount).toBe(100); // 2 free items × $50 = $100
    });

    it('should not apply BOGO if quantity is less than 2', () => {
      const cart: Cart = {
        items: [
          {
            productId: 'prod_1',
            sku: 'SKU001',
            quantity: 1,
            unitPrice: 50,
            totalPrice: 50,
          },
        ],
        subtotal: 50,
      };

      const coupon = {
        type: 'bogo' as const,
        value: 0,
        conditions: {
          productSkus: ['SKU001'],
        },
      } as any;

      const discount = applyCoupon(cart, coupon);
      expect(discount).toBe(0);
    });
  });

  describe('applyCoupon - Tiered discount', () => {
    it('should apply tiered discount when min order is met', () => {
      const coupon = {
        type: 'tiered' as const,
        value: 15, // 15% off
        conditions: {
          minOrder: 100,
        },
      } as any;

      const discount = applyCoupon(mockCart, coupon);
      expect(discount).toBe(15); // 15% of $100 = $15
    });

    it('should not apply tiered discount when min order is not met', () => {
      const smallCart: Cart = {
        items: [
          {
            productId: 'prod_1',
            sku: 'SKU001',
            quantity: 1,
            unitPrice: 50,
            totalPrice: 50,
          },
        ],
        subtotal: 50,
      };

      const coupon = {
        type: 'tiered' as const,
        value: 15,
        conditions: {
          minOrder: 100,
        },
      } as any;

      const discount = applyCoupon(smallCart, coupon);
      expect(discount).toBe(0);
    });
  });

  describe('validateCoupon', () => {
    const mockCoupon = {
      couponId: 'coupon_123',
      code: 'TEST10',
      type: 'percent' as const,
      value: 10,
      active: true,
      conditions: {},
      startsAt: undefined,
      endsAt: undefined,
    };

    beforeEach(() => {
      (Coupon.findOne as jest.Mock).mockResolvedValue(mockCoupon);
    });

    it('should validate valid coupon', async () => {
      const result = await validateCoupon('store_123', 'TEST10', mockCart);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10);
      expect(result.coupon).toBeDefined();
    });

    it('should reject invalid coupon code', async () => {
      (Coupon.findOne as jest.Mock).mockResolvedValue(null);

      const result = await validateCoupon('store_123', 'INVALID', mockCart);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon code not found');
    });

    it('should reject inactive coupon', async () => {
      (Coupon.findOne as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        active: false,
      });

      const result = await validateCoupon('store_123', 'TEST10', mockCart);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon is not active or has expired');
    });

    it('should reject expired coupon', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      (Coupon.findOne as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        endsAt: pastDate,
      });

      const result = await validateCoupon('store_123', 'TEST10', mockCart);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon is not active or has expired');
    });

    it('should reject if minimum order not met', async () => {
      (Coupon.findOne as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        conditions: {
          minOrder: 200,
        },
      });

      const result = await validateCoupon('store_123', 'TEST10', mockCart);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Minimum order');
    });

    it('should reject if required SKU not in cart', async () => {
      (Coupon.findOne as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        conditions: {
          productSkus: ['SKU999'],
        },
      });

      const result = await validateCoupon('store_123', 'TEST10', mockCart);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cart does not contain required products');
    });

    it('should reject if max redemptions reached', async () => {
      (Coupon.findOne as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        conditions: {
          maxRedemptions: 10,
        },
      });

      (CouponRedemption.countDocuments as jest.Mock).mockResolvedValue(10);

      const result = await validateCoupon('store_123', 'TEST10', mockCart, 'user_123');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Coupon has reached maximum redemptions');
    });

    it('should reject if user usage limit reached', async () => {
      (Coupon.findOne as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        conditions: {
          usageLimitPerUser: 1,
        },
      });

      (CouponRedemption.countDocuments as jest.Mock)
        .mockResolvedValueOnce(0) // Total redemptions
        .mockResolvedValueOnce(1); // User redemptions

      const result = await validateCoupon('store_123', 'TEST10', mockCart, 'user_123');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('You have reached the usage limit for this coupon');
    });
  });
});

