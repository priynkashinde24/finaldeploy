import { Request, Response, NextFunction } from 'express';
import { PayoutLedger } from '../models/PayoutLedger';
import { sendSuccess, sendError } from '../utils/responseFormatter';

/**
 * Get all payout ledgers with optional filters
 * GET /api/payouts
 * Query params: supplierId, resellerId, status
 */
export const getPayouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { supplierId, resellerId, status } = req.query;

    // Build filter
    const filter: any = {};
    if (supplierId) {
      filter.supplierId = supplierId as string;
    }
    if (resellerId) {
      filter.resellerId = resellerId as string;
    }
    if (status) {
      filter.status = status as string;
    }

    const payouts = await PayoutLedger.find(filter)
      .sort({ createdAt: -1 })
      .limit(1000); // Limit to prevent huge responses

    sendSuccess(res, payouts, 'Payouts retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get payout by order ID
 * GET /api/payouts/order/:orderId
 */
export const getPayoutByOrderId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const payout = await PayoutLedger.findOne({ orderId });

    if (!payout) {
      sendError(res, 'Payout not found', 404);
      return;
    }

    sendSuccess(res, payout, 'Payout retrieved successfully');
  } catch (error) {
    next(error);
  }
};

