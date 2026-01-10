import {
  applyGlobalMarkup,
  applySkuOverride,
  roundPrice,
} from '../pricingService';

describe('Pricing Service', () => {
  describe('roundPrice', () => {
    it('should round price to 2 decimal places', () => {
      expect(roundPrice(10.123)).toBe(10.12);
      expect(roundPrice(10.125)).toBe(10.13);
      expect(roundPrice(10.126)).toBe(10.13);
      expect(roundPrice(10.1)).toBe(10.1);
      expect(roundPrice(10)).toBe(10);
    });
  });

  describe('applyGlobalMarkup', () => {
    it('should apply positive markup correctly', () => {
      expect(applyGlobalMarkup(100, 10)).toBe(110); // +10%
      expect(applyGlobalMarkup(50, 20)).toBe(60); // +20%
      expect(applyGlobalMarkup(25, 5)).toBe(26.25); // +5%
    });

    it('should apply negative markup (discount) correctly', () => {
      expect(applyGlobalMarkup(100, -10)).toBe(90); // -10%
      expect(applyGlobalMarkup(50, -5)).toBe(47.5); // -5%
    });

    it('should handle zero markup', () => {
      expect(applyGlobalMarkup(100, 0)).toBe(100);
    });

    it('should round result to 2 decimal places', () => {
      expect(applyGlobalMarkup(33.33, 10)).toBe(36.66);
      expect(applyGlobalMarkup(10, 33.33)).toBe(13.33);
    });

    it('should throw error for negative base price', () => {
      expect(() => applyGlobalMarkup(-10, 10)).toThrow('Base price cannot be negative');
    });
  });

  describe('applySkuOverride', () => {
    it('should apply positive override correctly', () => {
      expect(applySkuOverride(100, 15)).toBe(115); // +15%
      expect(applySkuOverride(50, 25)).toBe(62.5); // +25%
    });

    it('should apply negative override (discount) correctly', () => {
      expect(applySkuOverride(100, -15)).toBe(85); // -15%
      expect(applySkuOverride(50, -10)).toBe(45); // -10%
    });

    it('should handle zero override', () => {
      expect(applySkuOverride(100, 0)).toBe(100);
    });

    it('should round result to 2 decimal places', () => {
      expect(applySkuOverride(33.33, 10)).toBe(36.66);
    });

    it('should throw error for negative base price', () => {
      expect(() => applySkuOverride(-10, 10)).toThrow('Base price cannot be negative');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small prices', () => {
      expect(applyGlobalMarkup(0.01, 10)).toBe(0.01);
      expect(applyGlobalMarkup(0.1, 10)).toBe(0.11);
    });

    it('should handle very large markups', () => {
      expect(applyGlobalMarkup(100, 100)).toBe(200); // +100%
      expect(applyGlobalMarkup(100, 200)).toBe(300); // +200%
    });

    it('should handle maximum discount', () => {
      expect(applyGlobalMarkup(100, -100)).toBe(0); // -100% = free
    });

    it('should handle decimal markups', () => {
      expect(applyGlobalMarkup(100, 10.5)).toBe(110.5);
      expect(applyGlobalMarkup(100, 0.5)).toBe(100.5);
    });
  });
});

