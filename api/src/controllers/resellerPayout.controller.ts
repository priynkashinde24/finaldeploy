import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { PayoutLedger } from '../models/PayoutLedger';
import { Order } from '../models/Order';
import { getPayoutSummary } from '../services/payout.service';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Reseller Payout Controller
 * 
 * PURPOSE:
 * - Reseller dashboard: view margin earned, pending, paid
 * - Read-only access
 */

const getResellerPayoutsSchema = z.object({
  status: z.enum(['pending', 'eligible', 'paid']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /reseller/payouts
 * Get reseller payouts
 */
export const getResellerPayouts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = getResellerPayoutsSchema.parse(req.query);

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
      entityType: 'reseller',
      entityId: currentUser.id,
    };

    if (validatedData.status) {
      query.status = validatedData.status;
    }

    const payouts = await PayoutLedger.find(query)
      .sort({ createdAt: -1 })
      .limit(validatedData.limit)
      .skip(validatedData.offset)
      .populate('paymentSplitId')
      .lean();

    const total = await PayoutLedger.countDocuments(query);

    // Get order details for each payout to get orderAmount
    const orderIds = payouts.map((p: any) => p.orderId);
    const orders = await Order.find({ orderId: { $in: orderIds } })
      .select('orderId orderNumber totalAmount grandTotal totalAmountWithTax')
      .lean();

    const ordersMap = new Map(orders.map((o: any) => [o.orderId, o]));

    // Format payouts with order data
    const formattedPayouts = payouts.map((p: any) => {
      const order = ordersMap.get(p.orderId);
      const orderAmount = order?.totalAmountWithTax || order?.grandTotal || order?.totalAmount || 0;
      
      // Map PayoutLedger status to frontend expected status
      let payoutStatus: 'pending' | 'processed' | 'failed' = 'pending';
      if (p.status === 'paid') {
        payoutStatus = 'processed';
      }

      return {
        _id: p._id,
        id: p._id.toString(),
        orderId: p.orderId,
        orderNumber: order?.orderNumber || p.orderId,
        orderAmount: orderAmount,
        marginAmount: p.amount, // The amount in PayoutLedger is the margin/earnings
        payoutAmount: p.amount,
        payoutStatus,
        payoutDate: p.paidAt || p.availableAt || p.createdAt,
        failureReason: p.metadata?.failureReason,
        status: p.status, // Keep original status for reference
        availableAt: p.availableAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    // Get summary
    const summary = await getPayoutSummary('reseller', currentUser.id, storeId);

    sendSuccess(
      res,
      {
        payouts: formattedPayouts,
        summary,
        pagination: {
          total,
          limit: validatedData.limit,
          offset: validatedData.offset,
          hasMore: validatedData.offset + validatedData.limit < total,
        },
      },
      'Reseller payouts retrieved successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reseller/payouts/summary
 * Get reseller payout summary
 */
export const getResellerPayoutSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const summary = await getPayoutSummary('reseller', currentUser.id, storeId);

    sendSuccess(res, summary, 'Reseller payout summary retrieved successfully');
  } catch (error) {
    next(error);
  }
};
