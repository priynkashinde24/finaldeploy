import { roundPrice } from './pricingService';

/**
 * Calculate split payment amounts for an order
 * @param totalAmount - Total order amount
 * @param supplierCost - Total cost to supplier (sum of product costs)
 * @param platformFeePercent - Platform fee percentage (e.g., 5 for 5%)
 * @returns Split payment breakdown
 */
export const calculateSplitPayment = (
  totalAmount: number,
  supplierCost: number,
  platformFeePercent: number = 5
): {
  totalAmount: number;
  supplierAmount: number;
  resellerAmount: number;
  platformFee: number;
} => {
  if (totalAmount < 0) {
    throw new Error('Total amount cannot be negative');
  }
  if (supplierCost < 0) {
    throw new Error('Supplier cost cannot be negative');
  }
  if (supplierCost > totalAmount) {
    throw new Error('Supplier cost cannot exceed total amount');
  }

  // Calculate platform fee
  const platformFee = roundPrice((totalAmount * platformFeePercent) / 100);

  // Calculate remaining amount after platform fee
  const amountAfterPlatformFee = roundPrice(totalAmount - platformFee);

  // Supplier gets their cost
  const supplierAmount = roundPrice(supplierCost);

  // Reseller gets the difference (markup profit)
  const resellerAmount = roundPrice(amountAfterPlatformFee - supplierAmount);

  // Verify the math
  const calculatedTotal = roundPrice(supplierAmount + resellerAmount + platformFee);
  if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
    // Allow small rounding differences
    console.warn(`Split payment calculation mismatch: ${calculatedTotal} vs ${totalAmount}`);
  }

  return {
    totalAmount: roundPrice(totalAmount),
    supplierAmount,
    resellerAmount,
    platformFee,
  };
};

