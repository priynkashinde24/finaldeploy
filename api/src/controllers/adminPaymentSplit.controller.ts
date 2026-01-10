import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { PaymentSplit } from '../models/PaymentSplit';
import { PayoutLedger } from '../models/PayoutLedger';
import { Order } from '../models/Order';
import mongoose from 'mongoose';
import { z } from 'zod';

/**
 * Admin Payment Split Controller
 * 
 * PURPOSE:
 * - Admin visibility into payment splits
 * - View splits by order, store, supplier, reseller
 * - View payout ledger
 * - Audit trail
 */

const getPaymentSplitsSchema = z.object({
  storeId: z.string().optional(),
  orderId: z.string().optional(),
  supplierId: z.string().optional(),
  resellerId: z.string().optional(),
  status: z.enum(['pending', 'locked', 'settled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /admin/payment-splits
 * Get payment splits with filters
 */
export const getPaymentSplits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = getPaymentSplitsSchema.parse(req.query);

    const query: any = {};

    if (validatedData.storeId) {
      query.storeId = new mongoose.Types.ObjectId(validatedData.storeId);
    }

    if (validatedData.orderId) {
      query.orderId = validatedData.orderId;
    }

    if (validatedData.supplierId) {
      query.supplierId = new mongoose.Types.ObjectId(validatedData.supplierId);
    }

    if (validatedData.resellerId) {
      query.resellerId = validatedData.resellerId;
    }

    if (validatedData.status) {
      query.status = validatedData.status;
    }

    const splits = await PaymentSplit.find(query)
      .sort({ createdAt: -1 })
      .limit(validatedData.limit)
      .skip(validatedData.offset)
      .populate('storeId', 'name')
      .populate('supplierId', 'name email')
      .lean();

    const total = await PaymentSplit.countDocuments(query);

    sendSuccess(
      res,
      {
        splits,
        pagination: {
          total,
          limit: validatedData.limit,
          offset: validatedData.offset,
          hasMore: validatedData.offset + validatedData.limit < total,
        },
      },
      'Payment splits retrieved successfully'
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
 * GET /admin/payment-splits/:orderId
 * Get payment split for a specific order
 */
export const getPaymentSplitByOrderId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const split = await PaymentSplit.findOne({ orderId })
      .populate('storeId', 'name')
      .populate('supplierId', 'name email')
      .lean();

    if (!split) {
      sendError(res, 'Payment split not found', 404);
      return;
    }

    // Get ledger entries
    const ledgerEntries = await PayoutLedger.find({ orderId })
      .sort({ entityType: 1, createdAt: 1 })
      .lean();

    sendSuccess(
      res,
      {
        split,
        ledgerEntries,
      },
      'Payment split retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

const getPayoutLedgerSchema = z.object({
  storeId: z.string().optional(),
  entityType: z.enum(['supplier', 'reseller', 'platform']).optional(),
  entityId: z.string().optional(),
  orderId: z.string().optional(),
  status: z.enum(['pending', 'eligible', 'paid']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /admin/payout-ledger
 * Get payout ledger entries
 */
export const getPayoutLedger = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = getPayoutLedgerSchema.parse(req.query);

    const query: any = {};

    if (validatedData.storeId) {
      query.storeId = new mongoose.Types.ObjectId(validatedData.storeId);
    }

    if (validatedData.entityType) {
      query.entityType = validatedData.entityType;
    }

    if (validatedData.entityId) {
      query.entityId = validatedData.entityId;
    }

    if (validatedData.orderId) {
      query.orderId = validatedData.orderId;
    }

    if (validatedData.status) {
      query.status = validatedData.status;
    }

    const ledgerEntries = await PayoutLedger.find(query)
      .sort({ createdAt: -1 })
      .limit(validatedData.limit)
      .skip(validatedData.offset)
      .populate('storeId', 'name')
      .populate('paymentSplitId')
      .lean();

    const total = await PayoutLedger.countDocuments(query);

    // Calculate summary
    const summary = await PayoutLedger.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    sendSuccess(
      res,
      {
        ledgerEntries,
        summary,
        pagination: {
          total,
          limit: validatedData.limit,
          offset: validatedData.offset,
          hasMore: validatedData.offset + validatedData.limit < total,
        },
      },
      'Payout ledger retrieved successfully'
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
 * GET /admin/payment-splits/order/:orderId/ledger
 * Get payment split and ledger for an order
 */
export const getOrderPaymentSplit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    const split = await PaymentSplit.findOne({ orderId })
      .populate('storeId', 'name')
      .populate('supplierId', 'name email')
      .lean();

    const ledgerEntries = await PayoutLedger.find({ orderId })
      .sort({ entityType: 1, createdAt: 1 })
      .lean();

    sendSuccess(
      res,
      {
        order,
        split,
        ledgerEntries,
      },
      'Order payment split retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

