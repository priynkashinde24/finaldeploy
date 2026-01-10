import mongoose from 'mongoose';
import { IReturnShippingRule } from '../models/ReturnShippingRule';
import { calculateShipping, ShippingSnapshot } from './shippingEngine';
import { SupplierOrigin } from '../models/SupplierOrigin';
import { IOrder } from '../models/Order';

/**
 * Return Shipping Cost Calculator
 *
 * PURPOSE:
 * - Calculate return shipping cost based on rule
 * - Support flat, percentage, and actual shipping
 * - Return payer and amount
 * - Be snapshot-based
 *
 * RULES:
 * - Flat: Fixed amount
 * - Percentage: % of original shipping
 * - Actual shipping: Calculate reverse route cost
 */

export interface CalculateReturnShippingParams {
  rule: IReturnShippingRule;
  originalShippingSnapshot?: ShippingSnapshot | null;
  rmaItem: {
    globalVariantId: mongoose.Types.ObjectId | string;
    quantity: number;
    originId: mongoose.Types.ObjectId | string;
  };
  order: IOrder;
  customerAddress: {
    country: string;
    state: string;
    city: string;
    zip: string;
    street?: string;
  };
  storeId: mongoose.Types.ObjectId | string;
}

export interface ReturnShippingCalculation {
  payer: 'customer' | 'supplier' | 'reseller' | 'platform';
  amount: number;
  chargeType: 'flat' | 'percentage' | 'actual_shipping';
  ruleSnapshot: {
    ruleId: mongoose.Types.ObjectId | string;
    scope: 'sku' | 'category' | 'global';
    payer: string;
    chargeType: string;
    chargeValue: number;
  };
}

/**
 * Calculate return shipping cost
 */
export async function calculateReturnShipping(
  params: CalculateReturnShippingParams
): Promise<ReturnShippingCalculation> {
  const { rule, originalShippingSnapshot, rmaItem, order, customerAddress, storeId } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  let returnShippingAmount = 0;

  // Calculate based on charge type
  if (rule.chargeType === 'flat') {
    // Fixed amount
    returnShippingAmount = rule.chargeValue;
  } else if (rule.chargeType === 'percentage') {
    // Percentage of original shipping
    if (!originalShippingSnapshot) {
      // Fallback: Use order shipping amount if snapshot not available
      const orderShipping = order.shippingAmount || 0;
      returnShippingAmount = (orderShipping * rule.chargeValue) / 100;
    } else {
      returnShippingAmount = (originalShippingSnapshot.totalShipping * rule.chargeValue) / 100;
    }
  } else if (rule.chargeType === 'actual_shipping') {
    // Calculate actual shipping cost (reverse route: customer → origin)
    try {
      // Get origin address
      const originId =
        typeof rmaItem.originId === 'string'
          ? new mongoose.Types.ObjectId(rmaItem.originId)
          : rmaItem.originId;

      const origin = await SupplierOrigin.findById(originId).lean();

      if (!origin) {
        throw new Error(`Origin not found: ${originId}`);
      }

      // Calculate shipping FROM customer address TO origin address (reverse route)
      const returnShippingResult = await calculateShipping({
        storeId: storeObjId,
        shippingAddress: {
          country: origin.address.country,
          state: origin.address.state,
          zip: origin.address.pincode,
        },
        orderWeight: rmaItem.quantity * 0.5, // Default 0.5 kg per item
        orderValue: 0, // Return shipping typically not based on value
        paymentMethod: (order.paymentMethod === 'crypto' ? 'stripe' : (order.paymentMethod || 'stripe')) as 'stripe' | 'paypal' | 'cod' | 'cod_partial', // Use original payment method, map crypto to stripe
      });

      returnShippingAmount = returnShippingResult.snapshot.totalShipping;
    } catch (error: any) {
      console.error(`[RETURN SHIPPING] Failed to calculate actual shipping:`, error);
      // Fallback to flat rate or percentage if actual shipping fails
      if (originalShippingSnapshot) {
        returnShippingAmount = originalShippingSnapshot.totalShipping * 0.5; // 50% of original as fallback
      } else {
        returnShippingAmount = 100; // Default flat fallback
      }
    }
  }

  // Ensure non-negative
  returnShippingAmount = Math.max(0, returnShippingAmount);

  // Round to 2 decimal places
  returnShippingAmount = Math.round(returnShippingAmount * 100) / 100;

  return {
    payer: rule.payer,
    amount: returnShippingAmount,
    chargeType: rule.chargeType,
    ruleSnapshot: {
      ruleId: rule._id,
      scope: rule.scope,
      payer: rule.payer,
      chargeType: rule.chargeType,
      chargeValue: rule.chargeValue,
    },
  };
}

