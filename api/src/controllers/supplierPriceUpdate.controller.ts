import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PriceUpdateJob, IPriceUpdateJob } from '../models/PriceUpdateJob';
import { StagedPriceUpdate, IStagedPriceUpdate } from '../models/StagedPriceUpdate';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { logAudit } from '../utils/auditLogger';
import { processPriceUpdateUpload } from '../services/priceUpdateProcessing.service';

/**
 * Supplier Price Update Controller
 * 
 * PURPOSE:
 * - Handle price update file uploads from suppliers
 * - Create price update jobs
 * - List price update history
 * - View price update details
 */

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'price-updates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `price-update-${uniqueSuffix}${ext}`);
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
    fileSize: 5 * 1024 * 1024, // 5MB limit (smaller than catalog uploads)
  },
});

/**
 * POST /supplier/price-updates/upload
 * Upload a price update file (CSV/XLSX with SKU + price)
 */
export const uploadPriceUpdateFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can upload price updates', 403);
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

    // Create price update job
    const updateJob = new PriceUpdateJob({
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

    await updateJob.save();

    // Log audit
    await logAudit({
      req,
      action: 'PRICE_UPDATE_UPLOAD_CREATED',
      entityType: 'PriceUpdateJob',
      entityId: updateJob._id.toString(),
      after: {
        fileName,
        fileType,
        status: 'uploaded',
      },
      description: `Price update file '${fileName}' uploaded by supplier`,
      metadata: {
        updateJobId: updateJob._id.toString(),
        fileSize: req.file.size,
      },
    });

    // Process file asynchronously
    processPriceUpdateUpload(updateJob._id).catch(error => {
      console.error(`Failed to process price update ${updateJob._id}:`, error);
    });

    sendSuccess(res, {
      updateJobId: updateJob._id,
      fileName,
      fileType,
      status: updateJob.status,
      message: 'Price update file uploaded successfully. Processing started.',
    }, 'Price update file uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /supplier/price-updates
 * List all price update uploads for the supplier
 */
export const getPriceUpdates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can view price updates', 403);
      return;
    }

    const storeId = req.store.storeId;
    const supplierId = req.user.id;
    const status = req.query.status as string | undefined;

    const query: any = { storeId, supplierId };
    if (status) {
      query.status = status;
    }

    const updates = await PriceUpdateJob.find(query)
      .sort({ createdAt: -1 })
      .select('fileName fileType status totalRows validRows invalidRows createdAt completedAt')
      .limit(100);

    sendSuccess(res, { updates, count: updates.length }, 'Price updates retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /supplier/price-updates/:jobId
 * Get details of a specific price update job
 */
export const getPriceUpdateDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can view price updates', 403);
      return;
    }

    const storeId = req.store.storeId;
    const supplierId = req.user.id;
    const { jobId } = req.params;

    const updateJob = await PriceUpdateJob.findOne({
      _id: jobId,
      storeId,
      supplierId,
    });

    if (!updateJob) {
      sendError(res, 'Price update job not found', 404);
      return;
    }

    // Get staged price updates for this job
    const stagedUpdates = await StagedPriceUpdate.find({ updateJobId: updateJob._id })
      .populate('supplierProductId', 'supplierSku costPrice')
      .sort({ rowNumber: 1 })
      .select('rowNumber normalizedData status validationErrors oldPrice supplierProductId')
      .limit(1000);

    sendSuccess(res, {
      updateJob,
      stagedUpdates,
      stagedUpdatesCount: stagedUpdates.length,
    }, 'Price update job details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /supplier/price-updates/:jobId/submit
 * Submit price update for approval (supplier action)
 */
export const submitPriceUpdateForApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    if (!req.user || req.user.role !== 'supplier') {
      sendError(res, 'Only suppliers can submit price updates for approval', 403);
      return;
    }

    const storeId = req.store.storeId;
    const supplierId = req.user.id;
    const { jobId } = req.params;

    const updateJob = await PriceUpdateJob.findOne({
      _id: jobId,
      storeId,
      supplierId,
    });

    if (!updateJob) {
      sendError(res, 'Price update job not found', 404);
      return;
    }

    if (updateJob.status !== 'pending_approval') {
      sendError(res, `Cannot submit price update with status: ${updateJob.status}`, 400);
      return;
    }

    if (updateJob.validRows === 0) {
      sendError(res, 'No valid price updates to submit for approval', 400);
      return;
    }

    // Update status (already pending_approval, but ensure it's set)
    updateJob.status = 'pending_approval';
    await updateJob.save();

    // Log audit
    await logAudit({
      req,
      action: 'PRICE_UPDATE_SUBMITTED_FOR_APPROVAL',
      entityType: 'PriceUpdateJob',
      entityId: updateJob._id.toString(),
      after: {
        status: 'pending_approval',
        validRows: updateJob.validRows,
        invalidRows: updateJob.invalidRows,
      },
      description: `Price update '${updateJob.fileName}' submitted for approval`,
      metadata: {
        updateJobId: updateJob._id.toString(),
        totalRows: updateJob.totalRows,
        validRows: updateJob.validRows,
      },
    });

    sendSuccess(res, updateJob, 'Price update submitted for approval successfully');
  } catch (error) {
    next(error);
  }
};

