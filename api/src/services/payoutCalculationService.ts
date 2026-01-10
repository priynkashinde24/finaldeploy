import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { ResellerPayout } from '../models/ResellerPayout';
import { SupplierPayout } from '../models/SupplierPayout';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';

/**
 * Payout Calculation Service
 * 
 * PURPOSE:
 * - Calculate and create payout records for resellers and suppliers
 * - Called immediately after order creation
 * - Amounts are snapshotted at order time (never recalculated)
 * 
 * COMMISSION LOGIC:
 * - For each order item:
 *   - sellingPrice = reseller's selling price (from order snapshot)
 *   - costPrice = supplier's cost price (looked up from SupplierProduct)
 *   - margin = sellingPrice - costPrice
 * 
 * - Reseller payout = sum of (margin * quantity) for all items
 * - Supplier payout = sum of (costPrice * quantity) for all items
 */

/**
 * Calculate cost price from reseller product
 * Formula: costPrice = sellingPrice / (1 + margin/100)
 */
function calculateCostPriceFromMargin(sellingPrice: number, margin: number): number {
  if (margin === 0) {
    return sellingPrice;
  }
  return sellingPrice / (1 + margin / 100);
}

/**
 * Create reseller payout for an order
 */
export async function createResellerPayout(order: IOrder): Promise<void> {
  try {
    const resellerId = new mongoose.Types.ObjectId(order.resellerId);

    // Check if payout already exists (prevent duplicates)
    const existingPayout = await ResellerPayout.findOne({
      resellerId,
      orderId: order.orderId,
    });

    if (existingPayout) {
      console.warn(`Reseller payout already exists for order ${order.orderId}`);
      return;
    }

    let totalOrderAmount = 0;
    let totalMarginAmount = 0;

    // Process each order item
    for (const item of order.items) {
      const productId = new mongoose.Types.ObjectId(item.productId);
      const supplierId = new mongoose.Types.ObjectId(item.supplierId);
      const sellingPrice = item.unitPrice;
      const quantity = item.quantity;

      // Calculate item total (selling price * quantity)
      const itemTotal = sellingPrice * quantity;
      totalOrderAmount += itemTotal;

      // Look up ResellerProduct to get margin
      const resellerProduct = await ResellerProduct.findOne({
        resellerId,
        productId,
        supplierId,
        status: 'active',
      });

      if (!resellerProduct) {
        console.warn(
          `ResellerProduct not found for reseller ${resellerId}, product ${productId}, supplier ${supplierId}. Using SupplierProduct cost price.`
        );

        // Fallback: Look up SupplierProduct to get cost price directly
        const supplierProduct = await SupplierProduct.findOne({
          supplierId,
          productId,
          status: 'active',
        });

        if (!supplierProduct) {
          console.error(
            `SupplierProduct not found for supplier ${supplierId}, product ${productId}. Cannot calculate margin.`
          );
          continue;
        }

        const costPrice = supplierProduct.costPrice;
        const margin = sellingPrice - costPrice;
        const marginAmount = margin * quantity;
        totalMarginAmount += marginAmount;
      } else {
        // Calculate cost price from margin
        const costPrice = calculateCostPriceFromMargin(sellingPrice, resellerProduct.margin);
        const margin = sellingPrice - costPrice;
        const marginAmount = margin * quantity;
        totalMarginAmount += marginAmount;
      }
    }

    // Round amounts
    totalOrderAmount = Math.round(totalOrderAmount * 100) / 100;
    totalMarginAmount = Math.round(totalMarginAmount * 100) / 100;

    // Create reseller payout
    const resellerPayout = new ResellerPayout({
      resellerId,
      orderId: order.orderId,
      orderAmount: totalOrderAmount,
      marginAmount: totalMarginAmount,
      payoutAmount: totalMarginAmount, // Reseller gets the margin
      payoutStatus: 'pending',
    });

    await resellerPayout.save();
    console.log(`Reseller payout created for order ${order.orderId}: ₹${totalMarginAmount}`);
  } catch (error) {
    console.error(`Error creating reseller payout for order ${order.orderId}:`, error);
    throw error;
  }
}

/**
 * Create supplier payout for an order
 * Note: An order may have items from multiple suppliers, so we create one payout per supplier
 */
export async function createSupplierPayout(order: IOrder): Promise<void> {
  try {
    // Group items by supplier
    const itemsBySupplier = new Map<string, typeof order.items>();

    for (const item of order.items) {
      const supplierId = item.supplierId;
      const supplierIdStr = supplierId.toString();
      if (!itemsBySupplier.has(supplierIdStr)) {
        itemsBySupplier.set(supplierIdStr, []);
      }
      itemsBySupplier.get(supplierIdStr)!.push(item);
    }

    // Create payout for each supplier
    for (const [supplierIdStr, items] of itemsBySupplier.entries()) {
      const supplierId = new mongoose.Types.ObjectId(supplierIdStr);

      // Check if payout already exists (prevent duplicates)
      const existingPayout = await SupplierPayout.findOne({
        supplierId,
        orderId: order.orderId,
      });

      if (existingPayout) {
        console.warn(`Supplier payout already exists for supplier ${supplierId}, order ${order.orderId}`);
        continue;
      }

      let totalOrderAmount = 0;
      let totalCostAmount = 0;

      // Process items for this supplier
      for (const item of items) {
        const productId = new mongoose.Types.ObjectId(item.productId);
        const sellingPrice = item.unitPrice;
        const quantity = item.quantity;

        // Calculate item total (selling price * quantity)
        const itemTotal = sellingPrice * quantity;
        totalOrderAmount += itemTotal;

        // Look up SupplierProduct to get cost price
        const supplierProduct = await SupplierProduct.findOne({
          supplierId,
          productId,
          status: 'active',
        });

        if (!supplierProduct) {
          console.warn(
            `SupplierProduct not found for supplier ${supplierId}, product ${productId}. Using ResellerProduct to calculate cost price.`
          );

          // Fallback: Look up ResellerProduct to calculate cost price from margin
          const resellerId = new mongoose.Types.ObjectId(order.resellerId);
          const resellerProduct = await ResellerProduct.findOne({
            resellerId,
            productId,
            supplierId,
            status: 'active',
          });

          if (!resellerProduct) {
            console.error(
              `ResellerProduct not found for reseller ${resellerId}, product ${productId}, supplier ${supplierId}. Cannot calculate cost price.`
            );
            continue;
          }

          const costPrice = calculateCostPriceFromMargin(sellingPrice, resellerProduct.margin);
          const costAmount = costPrice * quantity;
          totalCostAmount += costAmount;
        } else {
          const costPrice = supplierProduct.costPrice;
          const costAmount = costPrice * quantity;
          totalCostAmount += costAmount;
        }
      }

      // Round amounts
      totalOrderAmount = Math.round(totalOrderAmount * 100) / 100;
      totalCostAmount = Math.round(totalCostAmount * 100) / 100;

      // Create supplier payout
      const supplierPayout = new SupplierPayout({
        supplierId,
        orderId: order.orderId,
        orderAmount: totalOrderAmount,
        costAmount: totalCostAmount,
        payoutAmount: totalCostAmount, // Supplier gets the cost price
        payoutStatus: 'pending',
      });

      await supplierPayout.save();
      console.log(
        `Supplier payout created for supplier ${supplierId}, order ${order.orderId}: ₹${totalCostAmount}`
      );
    }
  } catch (error) {
    console.error(`Error creating supplier payout for order ${order.orderId}:`, error);
    throw error;
  }
}

/**
 * Reverse/cancel payouts for a cancelled order
 * Only reverses payouts that are still pending (not processed)
 */
export async function reversePayoutsForOrder(orderId: string): Promise<void> {
  try {
    // Find all pending reseller payouts for this order
    const resellerPayouts = await ResellerPayout.find({
      orderId,
      payoutStatus: 'pending',
    });

    // Mark as failed with cancellation reason
    for (const payout of resellerPayouts) {
      payout.payoutStatus = 'failed';
      payout.failureReason = 'Order cancelled';
      await payout.save();
    }

    // Find all pending supplier payouts for this order
    const supplierPayouts = await SupplierPayout.find({
      orderId,
      payoutStatus: 'pending',
    });

    // Mark as failed with cancellation reason
    for (const payout of supplierPayouts) {
      payout.payoutStatus = 'failed';
      payout.failureReason = 'Order cancelled';
      await payout.save();
    }

    console.log(
      `Reversed ${resellerPayouts.length} reseller and ${supplierPayouts.length} supplier payouts for cancelled order ${orderId}`
    );
  } catch (error) {
    console.error(`Error reversing payouts for order ${orderId}:`, error);
    throw error;
  }
}

