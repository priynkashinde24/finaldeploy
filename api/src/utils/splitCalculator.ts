import { IOrder, IOrderItem } from '../models/Order';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { roundPrice } from '../services/pricingService';
import mongoose from 'mongoose';

/**
 * Split Calculation Engine
 * 
 * PURPOSE:
 * - Calculate payment split for an order
 * - Validate amounts sum correctly
 * - Handle supplier cost lookup
 * 
 * LOGIC:
 * - supplierAmount = supplierCost * quantity (per item, then summed)
 * - resellerAmount = resellerPrice - supplierCost (per item, then summed)
 * - platformAmount = platformCommission (fixed % or fixed amount)
 * 
 * VALIDATION:
 * - resellerAmount ≥ 0
 * - platformAmount ≥ 0
 * - total = supplier + reseller + platform
 */

export interface SplitCalculationResult {
  totalAmount: number;
  supplierAmount: number;
  resellerAmount: number;
  platformAmount: number;
  supplierId: mongoose.Types.ObjectId;
  resellerId: string;
}

export interface SplitCalculationError {
  message: string;
  field?: string;
}

/**
 * Calculate cost price from margin
 * Formula: costPrice = sellingPrice / (1 + margin/100)
 */
function calculateCostPriceFromMargin(sellingPrice: number, margin: number): number {
  if (margin === 0) {
    return sellingPrice;
  }
  return sellingPrice / (1 + margin / 100);
}

/**
 * Calculate split payment for an order
 * 
 * @param order - Order document
 * @param platformCommissionPercent - Platform commission percentage (default: 5)
 * @returns Split calculation result
 * @throws Error if calculation fails or validation fails
 */
export async function calculateSplit(
  order: IOrder,
  platformCommissionPercent: number = 5
): Promise<SplitCalculationResult> {
  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  const totalAmount = order.totalAmountWithTax || order.totalAmount;
  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than 0');
  }

  // Group items by supplier
  const itemsBySupplier = new Map<string, IOrderItem[]>();
  
  for (const item of order.items) {
    const supplierId = item.supplierId;
    const supplierIdStr = supplierId.toString();
    if (!itemsBySupplier.has(supplierIdStr)) {
      itemsBySupplier.set(supplierIdStr, []);
    }
    itemsBySupplier.get(supplierIdStr)!.push(item);
  }

  // For now, we support single supplier per order
  // If multiple suppliers, we'll use the first one (can be enhanced later)
  if (itemsBySupplier.size > 1) {
    console.warn(`Order ${order.orderId} has items from multiple suppliers. Using first supplier for split calculation.`);
  }

  const firstSupplierId = Array.from(itemsBySupplier.keys())[0];
  if (!firstSupplierId) {
    throw new Error('No supplier ID found in order items');
  }

  const supplierObjId = new mongoose.Types.ObjectId(firstSupplierId);
  const resellerId = order.resellerId;
  const storeId = order.storeId;

  let totalSupplierAmount = 0;
  let totalResellerAmount = 0;

  // Calculate supplier and reseller amounts per item
  for (const item of order.items) {
    const productId = new mongoose.Types.ObjectId(item.productId);
    const sellingPrice = item.unitPrice;
    const quantity = item.quantity;
    const itemTotal = sellingPrice * quantity;

    // Look up SupplierProduct to get cost price
    let costPrice: number;
    
    const supplierProduct = await SupplierProduct.findOne({
      storeId,
      supplierId: supplierObjId,
      productId,
      status: 'active',
    });

    if (supplierProduct) {
      costPrice = supplierProduct.costPrice;
    } else {
      // Fallback: Look up ResellerProduct to calculate cost price from margin
      const resellerObjId = new mongoose.Types.ObjectId(resellerId);
      const resellerProduct = await ResellerProduct.findOne({
        storeId,
        resellerId: resellerObjId,
        globalProductId: productId,
        supplierId: supplierObjId,
        $or: [{ isActive: true }, { status: 'active' }], // Support both field names
      });

      if (!resellerProduct) {
        throw new Error(
          `Cannot determine supplier cost for product ${item.productId}. SupplierProduct and ResellerProduct not found.`
        );
      }

      // Calculate cost from margin
      costPrice = calculateCostPriceFromMargin(sellingPrice, resellerProduct.margin);
    }

    const supplierAmount = roundPrice(costPrice * quantity);
    const resellerAmount = roundPrice(itemTotal - supplierAmount);

    if (resellerAmount < 0) {
      throw new Error(
        `Reseller amount cannot be negative for item ${item.productId}. Selling price (${sellingPrice}) is less than cost price (${costPrice}).`
      );
    }

    totalSupplierAmount += supplierAmount;
    totalResellerAmount += resellerAmount;
  }

  // Round totals
  totalSupplierAmount = roundPrice(totalSupplierAmount);
  totalResellerAmount = roundPrice(totalResellerAmount);

  // Calculate platform commission
  const platformAmount = roundPrice((totalAmount * platformCommissionPercent) / 100);

  // Adjust reseller amount to account for platform commission
  // After platform fee, remaining amount is split between supplier and reseller
  const amountAfterPlatformFee = roundPrice(totalAmount - platformAmount);
  const adjustedResellerAmount = roundPrice(amountAfterPlatformFee - totalSupplierAmount);

  // Validate reseller amount is non-negative
  if (adjustedResellerAmount < 0) {
    throw new Error(
      `Reseller amount cannot be negative after platform commission. Total: ${totalAmount}, Platform: ${platformAmount}, Supplier: ${totalSupplierAmount}, Remaining: ${amountAfterPlatformFee}`
    );
  }

  // Final validation: amounts must sum to totalAmount
  const calculatedTotal = roundPrice(totalSupplierAmount + adjustedResellerAmount + platformAmount);
  const difference = Math.abs(calculatedTotal - totalAmount);

  if (difference > 0.01) {
    throw new Error(
      `Split calculation mismatch: supplierAmount (${totalSupplierAmount}) + resellerAmount (${adjustedResellerAmount}) + platformAmount (${platformAmount}) = ${calculatedTotal}, but totalAmount = ${totalAmount}`
    );
  }

  return {
    totalAmount: roundPrice(totalAmount),
    supplierAmount: totalSupplierAmount,
    resellerAmount: adjustedResellerAmount,
    platformAmount,
    supplierId: supplierObjId,
    resellerId,
  };
}

