import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PriceUpdateJob, IPriceUpdateJob } from '../models/PriceUpdateJob';
import { StagedPriceUpdate, IStagedPriceUpdate } from '../models/StagedPriceUpdate';
import { SupplierProduct } from '../models/SupplierProduct';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { logAudit } from '../utils/auditLogger';

/**
 * Admin Price Update Approval Controller
 * 
 * PURPOSE:
 * - Approve/reject price update uploads
 * - Apply price updates to SupplierProduct records
 * - Transaction-safe operations
 */

/**
 * GET /admin/price-updates
 * List all price update uploads pending approval
 */
export const getPendingPriceUpdates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can view pending price updates', 403);
      return;
    }

    const status = req.query.status as string | undefined;
    const query: any = { status: status || 'pending_approval' };

    const updates = await PriceUpdateJob.find(query)
      .populate('supplierId', 'name email')
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .select('fileName fileType status totalRows validRows invalidRows createdAt completedAt supplierId storeId')
      .limit(100);

    sendSuccess(res, { updates, count: updates.length }, 'Pending price updates retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/price-updates/:jobId
 * Get details of a specific price update job (admin view)
 */
export const getPriceUpdateDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can view price update details', 403);
      return;
    }

    const { jobId } = req.params;

    const updateJob = await PriceUpdateJob.findById(jobId)
      .populate('supplierId', 'name email')
      .populate('storeId', 'name');

    if (!updateJob) {
      sendError(res, 'Price update job not found', 404);
      return;
    }

    // Get staged price updates
    const stagedUpdates = await StagedPriceUpdate.find({ updateJobId: updateJob._id })
      .populate('supplierProductId', 'supplierSku costPrice stockQuantity')
      .sort({ rowNumber: 1 })
      .select('rowNumber normalizedData status validationErrors oldPrice supplierProductId')
      .limit(1000);

    // Group by status
    const validUpdates = stagedUpdates.filter(u => u.status === 'valid');
    const invalidUpdates = stagedUpdates.filter(u => u.status === 'invalid');

    sendSuccess(res, {
      updateJob,
      stagedUpdates,
      summary: {
        total: stagedUpdates.length,
        valid: validUpdates.length,
        invalid: invalidUpdates.length,
      },
    }, 'Price update job details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/price-updates/:jobId/approve
 * Approve price update and apply to SupplierProduct records
 * 
 * TRANSACTION SAFETY:
 * - All operations wrapped in MongoDB transaction
 * - Either ALL approved updates apply OR rollback fully
 */
export const approvePriceUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can approve price updates', 403);
      await session.abortTransaction();
      return;
    }

    if (!req.store) {
      sendError(res, 'Store context required', 400);
      await session.abortTransaction();
      return;
    }

    const adminId = new mongoose.Types.ObjectId(req.user.id);
    const { jobId } = req.params;
    const { approvedUpdateIds } = req.body || {};

    // Get price update job
    const updateJob = await PriceUpdateJob.findById(jobId).session(session);
    if (!updateJob) {
      sendError(res, 'Price update job not found', 404);
      await session.abortTransaction();
      return;
    }

    if (updateJob.status !== 'pending_approval') {
      sendError(res, `Cannot approve price update with status: ${updateJob.status}`, 400);
      await session.abortTransaction();
      return;
    }

    // Get valid staged price updates
    const stagedUpdates = await StagedPriceUpdate.find({
      updateJobId: updateJob._id,
      status: 'valid',
    }).session(session);

    if (stagedUpdates.length === 0) {
      sendError(res, 'No valid price updates to approve', 400);
      await session.abortTransaction();
      return;
    }

    // Filter by approvedUpdateIds if provided
    let updatesToApprove = stagedUpdates;
    if (approvedUpdateIds && Array.isArray(approvedUpdateIds) && approvedUpdateIds.length > 0) {
      updatesToApprove = stagedUpdates.filter(u => 
        approvedUpdateIds.includes(u._id.toString())
      );
    }

    if (updatesToApprove.length === 0) {
      sendError(res, 'No price updates selected for approval', 400);
      await session.abortTransaction();
      return;
    }

    const beforeState = {
      status: updateJob.status,
      validRows: updateJob.validRows,
      approvedUpdatesCount: 0,
    };

    let approvedCount = 0;
    let productsUpdated = 0;

    // Process each staged price update
    for (const stagedUpdate of updatesToApprove) {
      if (!stagedUpdate.supplierProductId) {
        continue; // Skip if no product linked
      }

      // Update SupplierProduct price
      const supplierProduct = await SupplierProduct.findById(stagedUpdate.supplierProductId).session(session);
      if (!supplierProduct) {
        continue; // Skip if product not found
      }

      const oldPrice = supplierProduct.costPrice;
      supplierProduct.costPrice = stagedUpdate.normalizedData.newPrice;
      await supplierProduct.save({ session });
      productsUpdated++;

      // Mark staged update as approved
      stagedUpdate.status = 'approved';
      stagedUpdate.approvedAt = new Date();
      stagedUpdate.approvedBy = adminId;
      await stagedUpdate.save({ session });

      approvedCount++;
    }

    // Update price update job
    updateJob.status = 'approved';
    updateJob.approvedAt = new Date();
    updateJob.approvedBy = adminId;
    await updateJob.save({ session });

    // Commit transaction
    await session.commitTransaction();

    const afterState = {
      status: updateJob.status,
      approvedUpdatesCount: approvedCount,
      productsUpdated,
    };

    // Log audit
    await logAudit({
      req,
      action: 'PRICE_UPDATE_APPROVED',
      entityType: 'PriceUpdateJob',
      entityId: updateJob._id.toString(),
      before: beforeState,
      after: afterState,
      description: `Price update '${updateJob.fileName}' approved by admin`,
      metadata: {
        updateJobId: updateJob._id.toString(),
        approvedCount,
        productsUpdated,
      },
    });

    sendSuccess(res, {
      updateJob,
      approvedCount,
      productsUpdated,
    }, 'Price update approved successfully');
  } catch (error: any) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * POST /admin/price-updates/:jobId/reject
 * Reject price update
 */
export const rejectPriceUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can reject price updates', 403);
      return;
    }

    const adminId = new mongoose.Types.ObjectId(req.user.id);
    const { jobId } = req.params;
    const { reason } = req.body || {};

    const updateJob = await PriceUpdateJob.findById(jobId);
    if (!updateJob) {
      sendError(res, 'Price update job not found', 404);
      return;
    }

    if (updateJob.status === 'approved' || updateJob.status === 'rejected') {
      sendError(res, `Cannot reject price update with status: ${updateJob.status}`, 400);
      return;
    }

    const beforeState = updateJob.toObject();

    // Update price update job
    updateJob.status = 'rejected';
    updateJob.rejectedAt = new Date();
    updateJob.rejectedBy = adminId;
    updateJob.rejectionReason = reason || 'Rejected by admin';

    // Mark all staged updates as rejected
    await StagedPriceUpdate.updateMany(
      { updateJobId: updateJob._id },
      {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: adminId,
        rejectionReason: reason || 'Rejected by admin',
      }
    );

    await updateJob.save();

    // Log audit
    await logAudit({
      req,
      action: 'PRICE_UPDATE_REJECTED',
      entityType: 'PriceUpdateJob',
      entityId: updateJob._id.toString(),
      before: beforeState,
      after: updateJob.toObject(),
      description: `Price update '${updateJob.fileName}' rejected by admin`,
      metadata: {
        updateJobId: updateJob._id.toString(),
        reason: updateJob.rejectionReason,
      },
    });

    sendSuccess(res, updateJob, 'Price update rejected successfully');
  } catch (error) {
    next(error);
  }
};

