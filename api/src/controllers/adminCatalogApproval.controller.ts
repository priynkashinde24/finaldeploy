import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { CatalogUploadJob, ICatalogUploadJob } from '../models/CatalogUploadJob';
import { StagedProduct, IStagedProduct } from '../models/StagedProduct';
import { Product } from '../models/Product';
import { SupplierProduct } from '../models/SupplierProduct';
import { Brand } from '../models/Brand';
import { Category } from '../models/Category';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { logAudit } from '../utils/auditLogger';

/**
 * Admin Catalog Approval Controller
 * 
 * PURPOSE:
 * - Approve/reject catalog uploads
 * - Create new global products when needed
 * - Move staged products to live catalog
 * - Transaction-safe operations
 */

/**
 * GET /admin/catalog/uploads
 * List all catalog uploads pending approval
 */
export const getPendingUploads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can view pending uploads', 403);
      return;
    }

    const status = req.query.status as string | undefined;
    const query: any = { status: status || 'pending_approval' };

    const uploads = await CatalogUploadJob.find(query)
      .populate('supplierId', 'name email')
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .select('fileName fileType status totalRows validRows invalidRows createdAt completedAt supplierId storeId')
      .limit(100);

    sendSuccess(res, { uploads, count: uploads.length }, 'Pending uploads retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/catalog/uploads/:jobId
 * Get details of a specific upload job (admin view)
 */
export const getUploadDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can view upload details', 403);
      return;
    }

    const { jobId } = req.params;

    const uploadJob = await CatalogUploadJob.findById(jobId)
      .populate('supplierId', 'name email')
      .populate('storeId', 'name');

    if (!uploadJob) {
      sendError(res, 'Upload job not found', 404);
      return;
    }

    // Get staged products
    const stagedProducts = await StagedProduct.find({ uploadJobId: uploadJob._id })
      .sort({ rowNumber: 1 })
      .select('rowNumber normalizedData status validationErrors globalProductId requiresApproval')
      .limit(1000);

    // Group by status
    const validProducts = stagedProducts.filter(p => p.status === 'valid');
    const invalidProducts = stagedProducts.filter(p => p.status === 'invalid');
    const requiresApproval = stagedProducts.filter(p => p.requiresApproval);

    sendSuccess(res, {
      uploadJob,
      stagedProducts,
      summary: {
        total: stagedProducts.length,
        valid: validProducts.length,
        invalid: invalidProducts.length,
        requiresApproval: requiresApproval.length,
      },
    }, 'Upload job details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/catalog/uploads/:jobId/approve
 * Approve catalog upload and move products to live catalog
 * 
 * TRANSACTION SAFETY:
 * - All operations wrapped in MongoDB transaction
 * - Either ALL approved rows move live OR rollback fully
 * - Creates new global products if needed
 * - Creates SupplierProduct records
 */
export const approveCatalogUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can approve catalog uploads', 403);
      await session.abortTransaction();
      return;
    }

    if (!req.store) {
      sendError(res, 'Store context required', 400);
      await session.abortTransaction();
      return;
    }

    const storeId = req.store.storeId;
    const adminId = new mongoose.Types.ObjectId(req.user.id);
    const { jobId } = req.params;
    const { approvedProductIds, createNewProducts } = req.body || {};

    // Get upload job
    const uploadJob = await CatalogUploadJob.findById(jobId).session(session);
    if (!uploadJob) {
      sendError(res, 'Upload job not found', 404);
      await session.abortTransaction();
      return;
    }

    if (uploadJob.status !== 'pending_approval') {
      sendError(res, `Cannot approve upload with status: ${uploadJob.status}`, 400);
      await session.abortTransaction();
      return;
    }

    // Get valid staged products
    const stagedProducts = await StagedProduct.find({
      uploadJobId: uploadJob._id,
      status: 'valid',
    }).session(session);

    if (stagedProducts.length === 0) {
      sendError(res, 'No valid products to approve', 400);
      await session.abortTransaction();
      return;
    }

    // Filter by approvedProductIds if provided
    let productsToApprove = stagedProducts;
    if (approvedProductIds && Array.isArray(approvedProductIds) && approvedProductIds.length > 0) {
      productsToApprove = stagedProducts.filter(p => 
        approvedProductIds.includes(p._id.toString())
      );
    }

    if (productsToApprove.length === 0) {
      sendError(res, 'No products selected for approval', 400);
      await session.abortTransaction();
      return;
    }

    const beforeState = {
      status: uploadJob.status,
      validRows: uploadJob.validRows,
      approvedProductsCount: 0,
    };

    let approvedCount = 0;
    let newProductsCreated = 0;
    let supplierProductsCreated = 0;

    // Process each staged product
    for (const stagedProduct of productsToApprove) {
      let globalProductId = stagedProduct.globalProductId;

      // If product doesn't exist and createNewProducts is true, create it
      if (!globalProductId && createNewProducts) {
        const normalized = stagedProduct.normalizedData;

        // Ensure category exists
        if (!normalized.categoryId) {
          continue; // Skip if category not found
        }

        // Create new global product
        const newProduct = new Product({
          storeId,
          name: normalized.productName,
          slug: normalized.productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description: normalized.description || '',
          categoryId: normalized.categoryId,
          brandId: normalized.brandId,
          images: normalized.images || [],
          basePrice: normalized.costPrice, // Use cost price as base price
          status: 'active',
          createdBy: adminId,
        });

        await newProduct.save({ session });
        globalProductId = newProduct._id;
        newProductsCreated++;
      }

      if (!globalProductId) {
        continue; // Skip if product doesn't exist and not creating new ones
      }

      // Create or update SupplierProduct
      const existingSupplierProduct = await SupplierProduct.findOne({
        storeId,
        supplierId: uploadJob.supplierId,
        productId: globalProductId,
        variantId: null, // No variant for now
      }).session(session);

      if (existingSupplierProduct) {
        // Update existing
        existingSupplierProduct.supplierSku = stagedProduct.normalizedData.sku;
        existingSupplierProduct.costPrice = stagedProduct.normalizedData.costPrice;
        existingSupplierProduct.stockQuantity = stagedProduct.normalizedData.stock;
        existingSupplierProduct.minOrderQty = stagedProduct.normalizedData.minOrderQty || 1;
        existingSupplierProduct.status = 'active';
        await existingSupplierProduct.save({ session });
      } else {
        // Create new
        const supplierProduct = new SupplierProduct({
          storeId,
          supplierId: uploadJob.supplierId,
          productId: globalProductId,
          supplierSku: stagedProduct.normalizedData.sku,
          costPrice: stagedProduct.normalizedData.costPrice,
          stockQuantity: stagedProduct.normalizedData.stock,
          minOrderQty: stagedProduct.normalizedData.minOrderQty || 1,
          status: 'active',
        });

        await supplierProduct.save({ session });
        supplierProductsCreated++;
      }

      // Mark staged product as approved
      stagedProduct.status = 'approved';
      stagedProduct.approvedAt = new Date();
      stagedProduct.approvedBy = adminId;
      stagedProduct.globalProductId = globalProductId;
      await stagedProduct.save({ session });

      approvedCount++;
    }

    // Update upload job
    uploadJob.status = 'approved';
    uploadJob.approvedAt = new Date();
    uploadJob.approvedBy = adminId;
    await uploadJob.save({ session });

    // Commit transaction
    await session.commitTransaction();

    const afterState = {
      status: uploadJob.status,
      approvedProductsCount: approvedCount,
      newProductsCreated,
      supplierProductsCreated,
    };

    // Log audit
    await logAudit({
      req,
      action: 'CATALOG_APPROVED',
      entityType: 'CatalogUploadJob',
      entityId: uploadJob._id.toString(),
      before: beforeState,
      after: afterState,
      description: `Catalog upload '${uploadJob.fileName}' approved by admin`,
      metadata: {
        uploadJobId: uploadJob._id.toString(),
        approvedCount,
        newProductsCreated,
        supplierProductsCreated,
      },
    });

    sendSuccess(res, {
      uploadJob,
      approvedCount,
      newProductsCreated,
      supplierProductsCreated,
    }, 'Catalog upload approved successfully');
  } catch (error: any) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * POST /admin/catalog/uploads/:jobId/reject
 * Reject catalog upload
 */
export const rejectCatalogUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Only admins can reject catalog uploads', 403);
      return;
    }

    const adminId = new mongoose.Types.ObjectId(req.user.id);
    const { jobId } = req.params;
    const { reason } = req.body || {};

    const uploadJob = await CatalogUploadJob.findById(jobId);
    if (!uploadJob) {
      sendError(res, 'Upload job not found', 404);
      return;
    }

    if (uploadJob.status === 'approved' || uploadJob.status === 'rejected') {
      sendError(res, `Cannot reject upload with status: ${uploadJob.status}`, 400);
      return;
    }

    const beforeState = uploadJob.toObject();

    // Update upload job
    uploadJob.status = 'rejected';
    uploadJob.rejectedAt = new Date();
    uploadJob.rejectedBy = new mongoose.Types.ObjectId(adminId);
    uploadJob.rejectionReason = reason || 'Rejected by admin';

    // Mark all staged products as rejected
    await StagedProduct.updateMany(
      { uploadJobId: uploadJob._id },
      {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: adminId,
        rejectionReason: reason || 'Rejected by admin',
      }
    );

    await uploadJob.save();

    // Log audit
    await logAudit({
      req,
      action: 'CATALOG_REJECTED',
      entityType: 'CatalogUploadJob',
      entityId: uploadJob._id.toString(),
      before: beforeState,
      after: uploadJob.toObject(),
      description: `Catalog upload '${uploadJob.fileName}' rejected by admin`,
      metadata: {
        uploadJobId: uploadJob._id.toString(),
        reason: uploadJob.rejectionReason,
      },
    });

    sendSuccess(res, uploadJob, 'Catalog upload rejected successfully');
  } catch (error) {
    next(error);
  }
};

