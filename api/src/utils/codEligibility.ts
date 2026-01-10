import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { CODUserFlag } from '../models/CODUserFlag';
import { Store } from '../models/Store';

/**
 * COD Eligibility Engine
 * 
 * PURPOSE:
 * - Validate if COD is allowed for an order
 * - Check order value, user status, product categories, store settings, and address
 * 
 * RULES:
 * - Order value <= COD_LIMIT
 * - User not flagged for COD abuse
 * - Product category allows COD (if applicable)
 * - Store allows COD
 * - Address is serviceable
 */

export interface CODEligibilityParams {
  storeId: mongoose.Types.ObjectId | string;
  userId: string; // User email or ID
  orderAmount: number; // Total order amount
  items: Array<{
    productId: string;
    categoryId?: string | null;
  }>;
  shippingAddress?: {
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface CODEligibilityResult {
  allowed: boolean;
  reason?: string;
  codLimit?: number;
}

// Environment variable for COD limit (default: 5000 in smallest currency unit)
const COD_LIMIT = process.env.COD_LIMIT ? parseFloat(process.env.COD_LIMIT) : 500000; // 5000.00 in cents/paise

// Thresholds for blocking
const COD_FAILURE_THRESHOLD = parseInt(process.env.COD_FAILURE_THRESHOLD || '3', 10); // Block after 3 failures
const COD_CANCELLATION_THRESHOLD = parseFloat(process.env.COD_CANCELLATION_THRESHOLD || '50'); // Block if >50% cancelled

/**
 * Check COD eligibility for an order
 */
export async function checkCODEligibility(
  params: CODEligibilityParams
): Promise<CODEligibilityResult> {
  try {
    const storeId =
      typeof params.storeId === 'string' ? new mongoose.Types.ObjectId(params.storeId) : params.storeId;

    // 1. Check order value <= COD_LIMIT
    if (params.orderAmount > COD_LIMIT) {
      return {
        allowed: false,
        reason: `COD is only available for orders up to ${COD_LIMIT / 100} ${process.env.CURRENCY || 'USD'}`,
        codLimit: COD_LIMIT,
      };
    }

    // 2. Check if user is blocked for COD abuse
    const userFlag = await CODUserFlag.findOne({
      userId: params.userId,
      storeId: storeId,
      isBlocked: true,
    });

    if (userFlag) {
      return {
        allowed: false,
        reason: userFlag.blockedReason || 'COD is not available due to previous payment failures',
      };
    }

    // 3. Check user failure count and cancellation rate
    const userFlagData = await CODUserFlag.findOne({
      userId: params.userId,
      storeId: storeId,
    });

    if (userFlagData) {
      if (userFlagData.codFailureCount >= COD_FAILURE_THRESHOLD) {
        // Auto-block user
        userFlagData.isBlocked = true;
        userFlagData.blockedAt = new Date();
        userFlagData.blockedReason = `Exceeded COD failure threshold (${COD_FAILURE_THRESHOLD})`;
        await userFlagData.save();

        return {
          allowed: false,
          reason: 'COD is not available due to multiple payment failures',
        };
      }

      if (userFlagData.codCancellationRate >= COD_CANCELLATION_THRESHOLD) {
        // Auto-block user
        userFlagData.isBlocked = true;
        userFlagData.blockedAt = new Date();
        userFlagData.blockedReason = `High COD cancellation rate (${userFlagData.codCancellationRate}%)`;
        await userFlagData.save();

        return {
          allowed: false,
          reason: 'COD is not available due to high cancellation rate',
        };
      }
    }

    // 4. Check store allows COD (can be extended with store settings)
    const store = await Store.findById(storeId);
    if (!store || store.status !== 'active') {
      return {
        allowed: false,
        reason: 'Store is not active',
      };
    }

    // TODO: Add store-level COD settings check
    // if (store.settings?.codEnabled === false) {
    //   return {
    //     allowed: false,
    //     reason: 'COD is not available for this store',
    //   };
    // }

    // 5. Check address serviceability (basic check - can be extended)
    if (params.shippingAddress) {
      // Basic validation: ensure required fields are present
      if (
        !params.shippingAddress.city ||
        !params.shippingAddress.state ||
        !params.shippingAddress.zip ||
        !params.shippingAddress.country
      ) {
        return {
          allowed: false,
          reason: 'Complete shipping address is required for COD',
        };
      }

      // TODO: Add serviceability check based on pincode/city
      // This can integrate with shipping providers or maintain a serviceable areas list
    }

    // 6. Check product categories allow COD (if applicable)
    // TODO: Add category-level COD settings check
    // for (const item of params.items) {
    //   if (item.categoryId) {
    //     const category = await Category.findById(item.categoryId);
    //     if (category && category.codAllowed === false) {
    //       return {
    //         allowed: false,
    //         reason: `COD is not available for products in category ${category.name}`,
    //       };
    //     }
    //   }
    // }

    // All checks passed
    return {
      allowed: true,
      codLimit: COD_LIMIT,
    };
  } catch (error: any) {
    console.error('[COD ELIGIBILITY] Error checking eligibility:', error);
    return {
      allowed: false,
      reason: 'Error checking COD eligibility',
    };
  }
}

/**
 * Update user COD failure count
 */
export async function recordCODFailure(
  userId: string,
  storeId: mongoose.Types.ObjectId | string
): Promise<void> {
  try {
    const storeObjId =
      typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

    const userFlag = await CODUserFlag.findOneAndUpdate(
      {
        userId,
        storeId: storeObjId,
      },
      {
        $inc: { codFailureCount: 1 },
        $set: { lastFailureAt: new Date() },
      },
      {
        upsert: true,
        new: true,
      }
    );

    // Check if threshold exceeded
    if (userFlag.codFailureCount >= COD_FAILURE_THRESHOLD) {
      userFlag.isBlocked = true;
      userFlag.blockedAt = new Date();
      userFlag.blockedReason = `Exceeded COD failure threshold (${COD_FAILURE_THRESHOLD})`;
      await userFlag.save();
    }
  } catch (error: any) {
    console.error('[COD ELIGIBILITY] Error recording failure:', error);
  }
}

/**
 * Update user COD cancellation rate
 */
export async function updateCODCancellationRate(
  userId: string,
  storeId: mongoose.Types.ObjectId | string
): Promise<void> {
  try {
    const storeObjId =
      typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

    // Get all COD orders for this user
    const codOrders = await Order.find({
      storeId: storeObjId,
      paymentMethod: 'cod',
      customerEmail: userId, // Assuming userId is email
    });

    const totalCODOrders = codOrders.length;
    const cancelledCODOrders = codOrders.filter(
      (order) => order.status === 'cancelled' || order.paymentStatus === 'cod_failed'
    ).length;

    const cancellationRate = totalCODOrders > 0 ? (cancelledCODOrders / totalCODOrders) * 100 : 0;

    await CODUserFlag.findOneAndUpdate(
      {
        userId,
        storeId: storeObjId,
      },
      {
        $set: {
          codCancellationRate: cancellationRate,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );
  } catch (error: any) {
    console.error('[COD ELIGIBILITY] Error updating cancellation rate:', error);
  }
}

