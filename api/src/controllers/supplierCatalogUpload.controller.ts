import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { CatalogUploadJob, ICatalogUploadJob } from '../models/CatalogUploadJob';
import { StagedProduct, IStagedProduct } from '../models/StagedProduct';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { logAudit } from '../utils/auditLogger';
import { processCatalogUpload } from '../services/catalogProcessing.service';

/**
 * Supplier Catalog Upload Controller
 * 
 * PURPOSE:
 * - Handle file uploads from suppliers
 * - Create upload jobs
 * - List upload history
 * - View upload details
 */

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'catalog');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `catalog-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and XLSX files are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * POST /supplier/catalog/upload
 * Upload a catalog file (CSV/XLSX)
 */
export const uploadCatalogFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can upload catalogs', 403);
      return;
    }

    if (!req.file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    const storeId = req.store.storeId;
    const supplierId = req.user.id;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileExt = path.extname(fileName).toLowerCase();
    
    // Determine file type
    let fileType: 'csv' | 'xlsx' = 'csv';
    if (fileExt === '.xlsx' || fileExt === '.xls') {
      fileType = 'xlsx';
    } else if (fileExt !== '.csv') {
      // Clean up file
      fs.unlinkSync(filePath);
      sendError(res, 'Unsupported file format. Only CSV and XLSX files are allowed.', 400);
      return;
    }

    // Create upload job
    const uploadJob = new CatalogUploadJob({
      storeId,
      supplierId,
      fileUrl: filePath, // Local file path (in production, upload to S3/Cloudinary first)
      fileName,
      fileType,
      status: 'uploaded',
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: [],
    });

    await uploadJob.save();

    // Log audit
    await logAudit({
      req,
      action: 'CATALOG_UPLOAD_CREATED',
      entityType: 'CatalogUploadJob',
      entityId: uploadJob._id.toString(),
      after: {
        fileName,
        fileType,
        status: 'uploaded',
      },
      description: `Catalog file '${fileName}' uploaded by supplier`,
      metadata: {
        uploadJobId: uploadJob._id.toString(),
        fileSize: req.file.size,
      },
    });

    // Process file asynchronously (in production, use a job queue)
    // For now, process immediately
    processCatalogUpload(uploadJob._id).catch(error => {
      console.error(`Failed to process catalog upload ${uploadJob._id}:`, error);
    });

    sendSuccess(res, {
      uploadJobId: uploadJob._id,
      fileName,
      fileType,
      status: uploadJob.status,
      message: 'File uploaded successfully. Processing started.',
    }, 'Catalog file uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /supplier/catalog/uploads
 * List all catalog uploads for the supplier
 */
export const getCatalogUploads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can view catalog uploads', 403);
      return;
    }

    const storeId = req.store.storeId;
    const supplierId = req.user.id;
    const status = req.query.status as string | undefined;

    const query: any = { storeId, supplierId };
    if (status) {
      query.status = status;
    }

    const uploads = await CatalogUploadJob.find(query)
      .sort({ createdAt: -1 })
      .select('fileName fileType status totalRows validRows invalidRows createdAt completedAt')
      .limit(100);

    sendSuccess(res, { uploads, count: uploads.length }, 'Catalog uploads retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /supplier/catalog/uploads/:jobId
 * Get details of a specific upload job
 */
export const getCatalogUploadDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can view catalog uploads', 403);
      return;
    }

    const storeId = req.store.storeId;
    const supplierId = req.user.id;
    const { jobId } = req.params;

    const uploadJob = await CatalogUploadJob.findOne({
      _id: jobId,
      storeId,
      supplierId,
    });

    if (!uploadJob) {
      sendError(res, 'Upload job not found', 404);
      return;
    }

    // Get staged products for this upload
    const stagedProducts = await StagedProduct.find({ uploadJobId: uploadJob._id })
      .sort({ rowNumber: 1 })
      .select('rowNumber normalizedData status validationErrors globalProductId requiresApproval')
      .limit(1000); // Limit to prevent huge responses

    sendSuccess(res, {
      uploadJob,
      stagedProducts,
      stagedProductsCount: stagedProducts.length,
    }, 'Upload job details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /supplier/catalog/uploads/:jobId/submit
 * Submit upload for approval (supplier action)
 */
export const submitForApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can submit catalogs for approval', 403);
      return;
    }

    const storeId = req.store.storeId;
    const supplierId = req.user.id;
    const { jobId } = req.params;

    const uploadJob = await CatalogUploadJob.findOne({
      _id: jobId,
      storeId,
      supplierId,
    });

    if (!uploadJob) {
      sendError(res, 'Upload job not found', 404);
      return;
    }

    if (uploadJob.status !== 'pending_approval') {
      sendError(res, `Cannot submit upload with status: ${uploadJob.status}`, 400);
      return;
    }

    if (uploadJob.validRows === 0) {
      sendError(res, 'No valid rows to submit for approval', 400);
      return;
    }

    // Update status (already pending_approval, but ensure it's set)
    uploadJob.status = 'pending_approval';
    await uploadJob.save();

    // Log audit
    await logAudit({
      req,
      action: 'CATALOG_SUBMITTED_FOR_APPROVAL',
      entityType: 'CatalogUploadJob',
      entityId: uploadJob._id.toString(),
      after: {
        status: 'pending_approval',
        validRows: uploadJob.validRows,
        invalidRows: uploadJob.invalidRows,
      },
      description: `Catalog upload '${uploadJob.fileName}' submitted for approval`,
      metadata: {
        uploadJobId: uploadJob._id.toString(),
        totalRows: uploadJob.totalRows,
        validRows: uploadJob.validRows,
      },
    });

    sendSuccess(res, uploadJob, 'Catalog submitted for approval successfully');
  } catch (error) {
    next(error);
  }
};

