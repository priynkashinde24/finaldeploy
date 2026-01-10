import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { processPayoutFromLedger, processEligiblePayoutsForEntity } from '../services/stripeConnectPayout.service';
import { getEligiblePayouts } from '../services/payout.service';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Payout Execution Controller
 * 
 * PURPOSE:
 * - Execute payouts from ledger
 * - Manual payout processing
 * - Batch payout processing
 * - Admin and system access
 */

const processPayoutSchema = z.object({
  payoutLedgerId: z.string().min(1),
});

const processBatchPayoutsSchema = z.object({
  entityType: z.enum(['supplier', 'reseller']),
  entityId: z.string().min(1),
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
});

/**
 * POST /admin/payouts/process
 * Process a single payout from ledger
 */
export const processPayout = async (
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

    const validatedData = processPayoutSchema.parse(req.body);
    const { payoutLedgerId } = validatedData;

    const result = await processPayoutFromLedger({
      payoutLedgerId,
      storeId,
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to process payout', 400);
      return;
    }

    sendSuccess(
      res,
      {
        payoutLedgerId,
        transferId: result.transferId,
        payoutReference: result.payoutReference,
      },
      'Payout processed successfully'
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
 * POST /admin/payouts/process-batch
 * Process all eligible payouts for an entity
 */
export const processBatchPayouts = async (
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

    const validatedData = processBatchPayoutsSchema.parse(req.body);
    const { entityType, entityId, limit } = validatedData;

    const result = await processEligiblePayoutsForEntity(entityType, entityId, storeId, limit);

    sendSuccess(
      res,
      {
        processed: result.processed,
        failed: result.failed,
        total: result.results.length,
        results: result.results.map((r, idx) => ({
          success: r.success,
          transferId: r.transferId,
          error: r.error,
        })),
      },
      `Batch payout processing completed: ${result.processed} processed, ${result.failed} failed`
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
 * GET /admin/payouts/eligible
 * Get eligible payouts ready for processing
 */
export const getEligiblePayoutsForProcessing = async (
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

    const entityType = req.query.entityType as 'supplier' | 'reseller' | 'platform' | undefined;
    const entityId = req.query.entityId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    if (!entityType || !entityId) {
      sendError(res, 'entityType and entityId are required', 400);
      return;
    }

    const { payouts, total } = await getEligiblePayouts({
      entityType,
      entityId,
      storeId,
      limit,
      offset,
    });

    // Filter out negative amounts (refunds/reversals)
    const positivePayouts = payouts.filter(p => p.amount > 0);

    sendSuccess(
      res,
      {
        payouts: positivePayouts,
        pagination: {
          total: positivePayouts.length,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      'Eligible payouts retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

