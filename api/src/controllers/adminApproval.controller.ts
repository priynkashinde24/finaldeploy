import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { SupplierKYC } from '../models/SupplierKYC';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

// Validation schema for rejection
const rejectSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500, 'Rejection reason must not exceed 500 characters'),
});

type ApprovalType = 'supplier' | 'kyc' | 'reseller';

interface PendingApproval {
  type: ApprovalType;
  entityId: string;
  name?: string;
  email: string;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  metadata?: Record<string, any>;
}

/**
 * GET /admin/approvals
 * Returns all approvals across different entity types (optionally filtered by status)
 */
export const listPendingApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, status } = req.query;
    
    const pendingApprovals: PendingApproval[] = [];

    // Build status filter (if status is provided, filter by it; otherwise return all)
    const statusFilter = status && ['pending', 'approved', 'rejected'].includes(status as string)
      ? (status as 'pending' | 'approved' | 'rejected')
      : undefined;

    // Fetch suppliers
    if (!type || type === 'supplier') {
      const supplierFilter: any = { role: 'supplier' };
      if (statusFilter) {
        supplierFilter.approvalStatus = statusFilter;
      }
      const suppliers = await User.find(supplierFilter)
        .select('name email approvalStatus createdAt')
        .sort({ createdAt: -1 })
        .lean();

      suppliers.forEach((supplier: any) => {
        pendingApprovals.push({
          type: 'supplier',
          entityId: supplier._id.toString(),
          name: supplier.name,
          email: supplier.email,
          submittedAt: supplier.createdAt,
          status: supplier.approvalStatus,
          rejectionReason: supplier.rejectionReason || null,
          metadata: {
            role: 'supplier',
          },
        });
      });
    }

    // Fetch KYC requests
    if (!type || type === 'kyc') {
      const kycFilter: any = {};
      if (statusFilter) {
        kycFilter.status = statusFilter;
      }
      const kycRequests = await SupplierKYC.find(kycFilter)
        .populate('supplierId', 'name email')
        .sort({ submittedAt: -1 })
        .lean();

      kycRequests.forEach((kyc: any) => {
        pendingApprovals.push({
          type: 'kyc',
          entityId: kyc._id.toString(),
          name: kyc.businessName,
          email: (kyc.supplierId as any).email,
          submittedAt: kyc.submittedAt,
          status: kyc.status,
          rejectionReason: kyc.rejectionReason || null,
          metadata: {
            businessName: kyc.businessName,
            panNumber: kyc.panNumber,
            supplierId: kyc.supplierId._id.toString(),
          },
        });
      });
    }

    // Fetch resellers (future-ready)
    if (!type || type === 'reseller') {
      const resellerFilter: any = { role: 'reseller' };
      if (statusFilter) {
        resellerFilter.approvalStatus = statusFilter;
      }
      const resellers = await User.find(resellerFilter)
        .select('name email approvalStatus createdAt')
        .sort({ createdAt: -1 })
        .lean();

      resellers.forEach((reseller: any) => {
        pendingApprovals.push({
          type: 'reseller',
          entityId: reseller._id.toString(),
          name: reseller.name,
          email: reseller.email,
          submittedAt: reseller.createdAt,
          status: reseller.approvalStatus,
          rejectionReason: reseller.rejectionReason || null,
          metadata: {
            role: 'reseller',
          },
        });
      });
    }

    // Sort by submission date (newest first)
    pendingApprovals.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

    sendSuccess(
      res,
      {
        approvals: pendingApprovals,
        total: pendingApprovals.length,
      },
      statusFilter ? `${statusFilter} approvals fetched successfully` : 'All approvals fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/approvals/:type/:id/approve
 * Approve an entity (supplier, kyc, or reseller)
 */
export const approveEntity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, id } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!['supplier', 'kyc', 'reseller'].includes(type)) {
      sendError(res, 'Invalid approval type', 400);
      return;
    }

    const approvalType = type as ApprovalType;
    const adminId = currentUser.id;

    let entity: any;
    let entityType: string;
    let entityEmail: string;

    if (approvalType === 'supplier' || approvalType === 'reseller') {
      // Approve user (supplier or reseller)
      entity = await User.findById(id);
      if (!entity) {
        sendError(res, `${approvalType} not found`, 404);
        return;
      }

      if (entity.role !== approvalType) {
        sendError(res, `User is not a ${approvalType}`, 400);
        return;
      }

      if (entity.approvalStatus === 'approved') {
        sendError(res, `${approvalType} is already approved`, 400);
        return;
      }

      // Safety check: prevent admin from approving themselves
      if (id === adminId) {
        sendError(res, 'You cannot approve your own account', 400);
        return;
      }

      // Update approval status
      entity.approvalStatus = 'approved';
      entity.approvedAt = new Date();
      entity.approvedBy = new mongoose.Types.ObjectId(adminId);
      entity.isActive = true; // Activate user
      entity.rejectionReason = null;
      await entity.save();

      entityType = 'User';
      entityEmail = entity.email;
    } else if (approvalType === 'kyc') {
      // Approve KYC
      entity = await SupplierKYC.findById(id).populate('supplierId');
      if (!entity) {
        sendError(res, 'KYC request not found', 404);
        return;
      }

      if (entity.status === 'approved') {
        sendError(res, 'KYC is already approved', 400);
        return;
      }

      // Update KYC status
      entity.status = 'approved';
      entity.reviewedAt = new Date();
      entity.approvedBy = new mongoose.Types.ObjectId(adminId);
      entity.rejectionReason = null;
      await entity.save();

      entityType = 'SupplierKYC';
      entityEmail = (entity.supplierId as any).email;
    } else {
      sendError(res, 'Invalid approval type', 400);
      return;
    }

    // Audit log
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: adminId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: `${approvalType.toUpperCase()}_APPROVED`,
      entityType,
      entityId: id,
      description: `Admin approved ${approvalType}: ${entityEmail}`,
      req,
      metadata: {
        approvalType,
        entityEmail,
        approvedAt: new Date().toISOString(),
      },
    });

    sendSuccess(
      res,
      {
        approval: {
          type: approvalType,
          entityId: id,
          status: approvalType === 'kyc' ? entity.status : entity.approvalStatus,
          approvedAt: approvalType === 'kyc' ? entity.reviewedAt : entity.approvedAt,
        },
      },
      `${approvalType} approved successfully`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/approvals/:type/:id/reject
 * Reject an entity (supplier, kyc, or reseller)
 */
export const rejectEntity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, id } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!['supplier', 'kyc', 'reseller'].includes(type)) {
      sendError(res, 'Invalid approval type', 400);
      return;
    }

    // Validate request body
    const validatedData = rejectSchema.parse(req.body);
    const { rejectionReason } = validatedData;

    const approvalType = type as ApprovalType;
    const adminId = currentUser.id;

    let entity: any;
    let entityType: string;
    let entityEmail: string;

    if (approvalType === 'supplier' || approvalType === 'reseller') {
      // Reject user (supplier or reseller)
      entity = await User.findById(id);
      if (!entity) {
        sendError(res, `${approvalType} not found`, 404);
        return;
      }

      // Safety check: prevent admin from rejecting themselves
      if (id === adminId) {
        sendError(res, 'You cannot reject your own account', 400);
        return;
      }

      if (entity.role !== approvalType) {
        sendError(res, `User is not a ${approvalType}`, 400);
        return;
      }

      if (entity.approvalStatus === 'rejected') {
        sendError(res, `${approvalType} is already rejected`, 400);
        return;
      }

      // Update approval status
      entity.approvalStatus = 'rejected';
      entity.approvedBy = new mongoose.Types.ObjectId(adminId);
      entity.isActive = false; // Deactivate user
      entity.rejectionReason = rejectionReason.trim();
      await entity.save();

      entityType = 'User';
      entityEmail = entity.email;
    } else if (approvalType === 'kyc') {
      // Reject KYC
      entity = await SupplierKYC.findById(id).populate('supplierId');
      if (!entity) {
        sendError(res, 'KYC request not found', 404);
        return;
      }

      if (entity.status === 'rejected') {
        sendError(res, 'KYC is already rejected', 400);
        return;
      }

      // Update KYC status
      entity.status = 'rejected';
      entity.reviewedAt = new Date();
      entity.approvedBy = new mongoose.Types.ObjectId(adminId);
      entity.rejectionReason = rejectionReason.trim();
      await entity.save();

      entityType = 'SupplierKYC';
      entityEmail = (entity.supplierId as any).email;
    } else {
      sendError(res, 'Invalid approval type', 400);
      return;
    }

    // Audit log
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: adminId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: `${approvalType.toUpperCase()}_REJECTED`,
      entityType,
      entityId: id,
      description: `Admin rejected ${approvalType}: ${entityEmail}`,
      req,
      metadata: {
        approvalType,
        entityEmail,
        rejectionReason: entity.rejectionReason,
        reviewedAt: new Date().toISOString(),
      },
    });

    sendSuccess(
      res,
      {
        approval: {
          type: approvalType,
          entityId: id,
          status: approvalType === 'kyc' ? entity.status : entity.approvalStatus,
          rejectionReason: entity.rejectionReason,
          reviewedAt: approvalType === 'kyc' ? entity.reviewedAt : new Date(),
        },
      },
      `${approvalType} rejected successfully`
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

