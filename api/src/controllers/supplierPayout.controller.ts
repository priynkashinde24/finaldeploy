import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { PayoutLedger } from '../models/PayoutLedger';
import { getPayoutSummary } from '../services/payout.service';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Supplier Payout Controller
 * 
 * PURPOSE:
 * - Supplier dashboard: view earnings, pending, paid
 * - Read-only access
 */

const getSupplierPayoutsSchema = z.object({
  status: z.enum(['pending', 'eligible', 'paid']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /supplier/payouts
 * Get supplier payouts
 */
export const getSupplierPayouts = async (
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

    const validatedData = getSupplierPayoutsSchema.parse(req.query);

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
      entityType: 'supplier',
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

    // Get summary
    const summary = await getPayoutSummary('supplier', currentUser.id, storeId);

    sendSuccess(
      res,
      {
        payouts,
        summary,
        pagination: {
          total,
          limit: validatedData.limit,
          offset: validatedData.offset,
          hasMore: validatedData.offset + validatedData.limit < total,
        },
      },
      'Supplier payouts retrieved successfully'
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
 * GET /supplier/payouts/summary
 * Get supplier payout summary
 */
export const getSupplierPayoutSummary = async (
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

    const summary = await getPayoutSummary('supplier', currentUser.id, storeId);

    sendSuccess(res, summary, 'Supplier payout summary retrieved successfully');
  } catch (error) {
    next(error);
  }
};
