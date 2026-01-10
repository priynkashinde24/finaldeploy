import { Request, Response, NextFunction } from 'express';
import { ResellerPayout } from '../models/ResellerPayout';
import { SupplierPayout } from '../models/SupplierPayout';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Admin Payout Controller
 * 
 * PURPOSE:
 * - Admin-only payout management
 * - View all payouts (reseller and supplier)
 * - Process payouts (mark as processed)
 * - Mark payouts as failed (with reason)
 * 
 * ACCOUNTING SAFETY:
 * - Payouts are immutable after processed
 * - No deletion of payout records
 * - All admin actions are logged (audit)
 */

// Validation schemas
const processPayoutSchema = z.object({
  payoutType: z.enum(['reseller', 'supplier']).optional(),
});

const failPayoutSchema = z.object({
  reason: z.string().min(1, 'Failure reason is required').max(500, 'Reason must not exceed 500 characters'),
  payoutType: z.enum(['reseller', 'supplier']).optional(),
});

/**
 * GET /admin/payouts
 * Get all payouts with filters
 * Query params: role (reseller/supplier), status (pending/processed/failed)
 */
export const getPayouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can access payout management', 403);
      return;
    }

    const { role, status } = req.query;

    // Build query filters
    const resellerQuery: any = {};
    const supplierQuery: any = {};

    if (status && (status === 'pending' || status === 'processed' || status === 'failed')) {
      resellerQuery.payoutStatus = status;
      supplierQuery.payoutStatus = status;
    }

    const results: any = {
      resellerPayouts: [],
      supplierPayouts: [],
    };

    // Fetch reseller payouts if role is 'reseller' or not specified
    if (!role || role === 'reseller') {
      const resellerPayouts = await ResellerPayout.find(resellerQuery)
        .populate('resellerId', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      results.resellerPayouts = resellerPayouts.map((payout) => ({
        id: payout._id.toString(),
        type: 'reseller',
        resellerId: payout.resellerId,
        resellerName: (payout.resellerId as any)?.name || 'Unknown',
        resellerEmail: (payout.resellerId as any)?.email || 'Unknown',
        orderId: payout.orderId,
        orderAmount: payout.orderAmount,
        marginAmount: payout.marginAmount,
        payoutAmount: payout.payoutAmount,
        payoutStatus: payout.payoutStatus,
        payoutDate: payout.payoutDate,
        failureReason: payout.failureReason,
        createdAt: payout.createdAt,
      }));
    }

    // Fetch supplier payouts if role is 'supplier' or not specified
    if (!role || role === 'supplier') {
      const supplierPayouts = await SupplierPayout.find(supplierQuery)
        .populate('supplierId', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      results.supplierPayouts = supplierPayouts.map((payout) => ({
        id: payout._id.toString(),
        type: 'supplier',
        supplierId: payout.supplierId,
        supplierName: (payout.supplierId as any)?.name || 'Unknown',
        supplierEmail: (payout.supplierId as any)?.email || 'Unknown',
        orderId: payout.orderId,
        orderAmount: payout.orderAmount,
        costAmount: payout.costAmount,
        payoutAmount: payout.payoutAmount,
        payoutStatus: payout.payoutStatus,
        payoutDate: payout.payoutDate,
        failureReason: payout.failureReason,
        createdAt: payout.createdAt,
      }));
    }

    // Calculate totals
    const totals = {
      reseller: {
        totalPending: results.resellerPayouts.filter((p: any) => p.payoutStatus === 'pending').length,
        totalProcessed: results.resellerPayouts.filter((p: any) => p.payoutStatus === 'processed').length,
        totalFailed: results.resellerPayouts.filter((p: any) => p.payoutStatus === 'failed').length,
        totalPendingAmount: results.resellerPayouts
          .filter((p: any) => p.payoutStatus === 'pending')
          .reduce((sum: number, p: any) => sum + p.payoutAmount, 0),
        totalProcessedAmount: results.resellerPayouts
          .filter((p: any) => p.payoutStatus === 'processed')
          .reduce((sum: number, p: any) => sum + p.payoutAmount, 0),
      },
      supplier: {
        totalPending: results.supplierPayouts.filter((p: any) => p.payoutStatus === 'pending').length,
        totalProcessed: results.supplierPayouts.filter((p: any) => p.payoutStatus === 'processed').length,
        totalFailed: results.supplierPayouts.filter((p: any) => p.payoutStatus === 'failed').length,
        totalPendingAmount: results.supplierPayouts
          .filter((p: any) => p.payoutStatus === 'pending')
          .reduce((sum: number, p: any) => sum + p.payoutAmount, 0),
        totalProcessedAmount: results.supplierPayouts
          .filter((p: any) => p.payoutStatus === 'processed')
          .reduce((sum: number, p: any) => sum + p.payoutAmount, 0),
      },
    };

    sendSuccess(res, { payouts: results, totals }, 'Payouts fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/payouts/:id/process
 * Mark payout as processed
 * Query param: type (reseller/supplier)
 */
export const processPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can process payouts', 403);
      return;
    }

    const { id } = req.params;
    const { type } = req.query;

    if (!type || (type !== 'reseller' && type !== 'supplier')) {
      sendError(res, 'Payout type (reseller/supplier) is required in query params', 400);
      return;
    }

    // Log audit action
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        action: 'PAYOUT_PROCESS',
        entityType: type === 'reseller' ? 'ResellerPayout' : 'SupplierPayout',
        entityId: id,
        description: `Admin processed ${type} payout`,
        req,
        metadata: {
          payoutId: id,
          payoutType: type,
        },
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
      // Continue even if audit logging fails
    }

    if (type === 'reseller') {
      const payout = await ResellerPayout.findById(id);

      if (!payout) {
        sendError(res, 'Reseller payout not found', 404);
        return;
      }

      // Safety: Cannot process already processed payout
      if (payout.payoutStatus === 'processed') {
        sendError(res, 'Payout is already processed and cannot be modified', 400);
        return;
      }

      payout.payoutStatus = 'processed';
      payout.payoutDate = new Date();
      await payout.save();

      sendSuccess(res, { payout }, 'Reseller payout processed successfully');
    } else {
      const payout = await SupplierPayout.findById(id);

      if (!payout) {
        sendError(res, 'Supplier payout not found', 404);
        return;
      }

      // Safety: Cannot process already processed payout
      if (payout.payoutStatus === 'processed') {
        sendError(res, 'Payout is already processed and cannot be modified', 400);
        return;
      }

      payout.payoutStatus = 'processed';
      payout.payoutDate = new Date();
      await payout.save();

      sendSuccess(res, { payout }, 'Supplier payout processed successfully');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/payouts/:id/fail
 * Mark payout as failed with reason
 * Query param: type (reseller/supplier)
 */
export const failPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can mark payouts as failed', 403);
      return;
    }

    const { id } = req.params;
    const { type } = req.query;

    if (!type || (type !== 'reseller' && type !== 'supplier')) {
      sendError(res, 'Payout type (reseller/supplier) is required in query params', 400);
      return;
    }

    // Validate request body
    const validatedData = failPayoutSchema.parse(req.body);
    const { reason } = validatedData;

    // Log audit action
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        action: 'PAYOUT_FAIL',
        entityType: type === 'reseller' ? 'ResellerPayout' : 'SupplierPayout',
        entityId: id,
        description: `Admin marked ${type} payout as failed: ${reason}`,
        req,
        metadata: {
          payoutId: id,
          payoutType: type,
          failureReason: reason,
        },
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
      // Continue even if audit logging fails
    }

    if (type === 'reseller') {
      const payout = await ResellerPayout.findById(id);

      if (!payout) {
        sendError(res, 'Reseller payout not found', 404);
        return;
      }

      // Safety: Cannot fail already processed payout
      if (payout.payoutStatus === 'processed') {
        sendError(res, 'Processed payouts cannot be marked as failed', 400);
        return;
      }

      payout.payoutStatus = 'failed';
      payout.failureReason = reason;
      await payout.save();

      sendSuccess(res, { payout }, 'Reseller payout marked as failed');
    } else {
      const payout = await SupplierPayout.findById(id);

      if (!payout) {
        sendError(res, 'Supplier payout not found', 404);
        return;
      }

      // Safety: Cannot fail already processed payout
      if (payout.payoutStatus === 'processed') {
        sendError(res, 'Processed payouts cannot be marked as failed', 400);
        return;
      }

      payout.payoutStatus = 'failed';
      payout.failureReason = reason;
      await payout.save();

      sendSuccess(res, { payout }, 'Supplier payout marked as failed');
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

