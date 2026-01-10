import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SupplierKYC } from '../models/SupplierKYC';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

// Validation schema for rejection
const rejectKycSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500, 'Rejection reason must not exceed 500 characters'),
});

/**
 * GET /admin/kyc
 * List all supplier KYC requests with filters
 */
export const listKYCRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    // Build filter
    const filter: any = {};
    if (status && (status === 'pending' || status === 'approved' || status === 'rejected')) {
      filter.status = status;
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch KYC requests with supplier info
    const [kycRequests, total] = await Promise.all([
      SupplierKYC.find(filter)
        .populate('supplierId', 'name email role')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SupplierKYC.countDocuments(filter),
    ]);

    // Format response
    const formattedKYC = kycRequests.map((kyc: any) => ({
      id: kyc._id.toString(),
      supplier: {
        id: kyc.supplierId._id.toString(),
        name: kyc.supplierId.name,
        email: kyc.supplierId.email,
      },
      businessName: kyc.businessName,
      panNumber: kyc.panNumber, // PAN is shown to admin for verification
      aadhaarNumber: kyc.aadhaarNumber, // Already masked
      gstNumber: kyc.gstNumber, // GST is shown to admin for verification
      documents: kyc.documents,
      status: kyc.status,
      rejectionReason: kyc.rejectionReason,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    }));

    sendSuccess(
      res,
      {
        kycRequests: formattedKYC,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'KYC requests fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/kyc/:id
 * Get single KYC request details
 */
export const getKYCRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const kyc = await SupplierKYC.findById(id).populate('supplierId', 'name email role');

    if (!kyc) {
      sendError(res, 'KYC request not found', 404);
      return;
    }

    sendSuccess(
      res,
      {
        kyc: {
          id: kyc._id.toString(),
          supplier: {
            id: (kyc.supplierId as any)._id.toString(),
            name: (kyc.supplierId as any).name,
            email: (kyc.supplierId as any).email,
          },
          businessName: kyc.businessName,
          panNumber: kyc.panNumber,
          aadhaarNumber: kyc.aadhaarNumber,
          gstNumber: kyc.gstNumber,
          documents: kyc.documents,
          status: kyc.status,
          rejectionReason: kyc.rejectionReason,
          submittedAt: kyc.submittedAt,
          reviewedAt: kyc.reviewedAt,
          createdAt: kyc.createdAt,
          updatedAt: kyc.updatedAt,
        },
      },
      'KYC request retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/kyc/:id/approve
 * Approve KYC request
 */
export const approveKYC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const kyc = await SupplierKYC.findById(id).populate('supplierId');

    if (!kyc) {
      sendError(res, 'KYC request not found', 404);
      return;
    }

    if (kyc.status === 'approved') {
      sendError(res, 'KYC is already approved', 400);
      return;
    }

    // Update KYC status
    kyc.status = 'approved';
    kyc.reviewedAt = new Date();
    kyc.approvedBy = new mongoose.Types.ObjectId(currentUser.id);
    kyc.rejectionReason = null;
    await kyc.save();

    // Audit log: KYC approved
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'KYC_APPROVED',
      entityType: 'SupplierKYC',
      entityId: kyc._id.toString(),
      description: `Admin approved KYC for supplier: ${(kyc.supplierId as any).email}`,
      req,
      metadata: {
        supplierEmail: (kyc.supplierId as any).email,
        businessName: kyc.businessName,
        reviewedAt: kyc.reviewedAt.toISOString(),
      },
    });

    sendSuccess(
      res,
      {
        kyc: {
          id: kyc._id.toString(),
          status: kyc.status,
          reviewedAt: kyc.reviewedAt,
        },
      },
      'KYC approved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/kyc/:id/reject
 * Reject KYC request
 */
export const rejectKYC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Validate request body
    const validatedData = rejectKycSchema.parse(req.body);
    const { rejectionReason } = validatedData;

    const kyc = await SupplierKYC.findById(id).populate('supplierId');

    if (!kyc) {
      sendError(res, 'KYC request not found', 404);
      return;
    }

    if (kyc.status === 'rejected') {
      sendError(res, 'KYC is already rejected', 400);
      return;
    }

    // Update KYC status
    kyc.status = 'rejected';
    kyc.reviewedAt = new Date();
    kyc.approvedBy = new mongoose.Types.ObjectId(currentUser.id);
    kyc.rejectionReason = rejectionReason.trim();
    await kyc.save();

    // Audit log: KYC rejected
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'KYC_REJECTED',
      entityType: 'SupplierKYC',
      entityId: kyc._id.toString(),
      description: `Admin rejected KYC for supplier: ${(kyc.supplierId as any).email}`,
      req,
      metadata: {
        supplierEmail: (kyc.supplierId as any).email,
        businessName: kyc.businessName,
        rejectionReason: kyc.rejectionReason,
        reviewedAt: kyc.reviewedAt.toISOString(),
      },
    });

    sendSuccess(
      res,
      {
        kyc: {
          id: kyc._id.toString(),
          status: kyc.status,
          rejectionReason: kyc.rejectionReason,
          reviewedAt: kyc.reviewedAt,
        },
      },
      'KYC rejected successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

