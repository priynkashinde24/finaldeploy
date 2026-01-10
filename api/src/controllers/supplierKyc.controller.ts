import { Request, Response, NextFunction } from 'express';
import { SupplierKYC } from '../models/SupplierKYC';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { maskAadhaar, getFileUrl } from '../utils/upload';
import { z } from 'zod';

// Validation schema for KYC submission
const kycSubmissionSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(200, 'Business name must not exceed 200 characters'),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format'),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar number must be 12 digits'),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format').optional(),
});

/**
 * POST /supplier/kyc
 * Submit KYC documents (supplier only)
 */
export const submitKYC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Only suppliers can submit KYC', 403);
      return;
    }

    // Check if KYC already exists
    const existingKYC = await SupplierKYC.findOne({ supplierId: currentUser.id });
    
    // Prevent duplicate submission if already approved
    if (existingKYC && existingKYC.status === 'approved') {
      sendError(res, 'KYC is already approved. Cannot resubmit.', 400);
      return;
    }
    
    // Prevent duplicate submission if already pending (unless explicitly rejected)
    if (existingKYC && existingKYC.status === 'pending') {
      sendError(res, 'KYC submission already pending. Please wait for admin review.', 400);
      return;
    }

    // Validate request body
    const validatedData = kycSubmissionSchema.parse(req.body);
    const { businessName, panNumber, aadhaarNumber, gstNumber } = validatedData;

    // Validate file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files.panCard || !files.panCard[0]) {
      sendError(res, 'PAN card document is required', 400);
      return;
    }
    if (!files.aadhaarFront || !files.aadhaarFront[0]) {
      sendError(res, 'Aadhaar front document is required', 400);
      return;
    }
    if (!files.aadhaarBack || !files.aadhaarBack[0]) {
      sendError(res, 'Aadhaar back document is required', 400);
      return;
    }

    // Mask Aadhaar number
    const maskedAadhaar = maskAadhaar(aadhaarNumber);

    // Get file URLs
    const panCardUrl = getFileUrl(files.panCard[0].filename);
    const aadhaarFrontUrl = getFileUrl(files.aadhaarFront[0].filename);
    const aadhaarBackUrl = getFileUrl(files.aadhaarBack[0].filename);
    const gstCertificateUrl = files.gstCertificate && files.gstCertificate[0] 
      ? getFileUrl(files.gstCertificate[0].filename) 
      : undefined;

    // Create or update KYC record
    const kycData = {
      supplierId: currentUser.id,
      businessName: businessName.trim(),
      panNumber: panNumber.toUpperCase().trim(),
      aadhaarNumber: maskedAadhaar,
      gstNumber: gstNumber ? gstNumber.toUpperCase().trim() : undefined,
      documents: {
        panCardUrl,
        aadhaarFrontUrl,
        aadhaarBackUrl,
        ...(gstCertificateUrl && { gstCertificateUrl }),
      },
      status: 'pending' as const,
      submittedAt: new Date(),
      rejectionReason: null,
      reviewedAt: null,
    };

    let kyc;
    if (existingKYC) {
      // Update existing KYC (if rejected, allow resubmission)
      kyc = await SupplierKYC.findByIdAndUpdate(
        existingKYC._id,
        kycData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new KYC
      kyc = await SupplierKYC.create(kycData);
    }

    if (!kyc) {
      sendError(res, 'Failed to create or update KYC', 500);
      return;
    }

    // Audit log: KYC submitted
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'KYC_SUBMITTED',
      entityType: 'SupplierKYC',
      entityId: kyc._id.toString(),
      description: `Supplier submitted KYC documents`,
      req,
      metadata: {
        businessName: kyc.businessName,
        panNumber: kyc.panNumber,
      },
    });

    sendSuccess(
      res,
      {
        kyc: {
          id: kyc._id.toString(),
          businessName: kyc.businessName,
          panNumber: kyc.panNumber,
          status: kyc.status,
          submittedAt: kyc.submittedAt,
        },
      },
      'KYC submitted successfully. Awaiting admin review.',
      201
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
 * GET /supplier/kyc
 * Get supplier's own KYC status
 */
export const getSupplierKYC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Only suppliers can view their KYC', 403);
      return;
    }

    const kyc = await SupplierKYC.findOne({ supplierId: currentUser.id });

    if (!kyc) {
      sendSuccess(
        res,
        {
          kyc: null,
        },
        'No KYC submission found'
      );
      return;
    }

    sendSuccess(
      res,
      {
        kyc: {
          id: kyc._id.toString(),
          businessName: kyc.businessName,
          panNumber: kyc.panNumber,
          aadhaarNumber: kyc.aadhaarNumber, // Already masked
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
      'KYC retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

