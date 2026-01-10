import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { CatalogUploadJob, ICatalogUploadJob } from '../models/CatalogUploadJob';
import { StagedProduct, IStagedProduct } from '../models/StagedProduct';
import { parseCatalogFile, ParsedCatalogRow } from './catalogParser.service';
import { validateCatalogRows, ValidationResult } from './catalogValidation.service';
import { mapCatalogRowsToProducts, MappingResult } from './catalogMapping.service';

/**
 * Catalog Processing Service
 * 
 * PURPOSE:
 * - Orchestrates the full catalog upload processing pipeline
 * - Parses file → Validates rows → Maps to products → Creates staged products
 * - Updates upload job status and statistics
 */

export interface ProcessingResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  stagedProductIds: mongoose.Types.ObjectId[];
}

/**
 * Process a catalog upload job
 * 
 * Flow:
 * 1. Parse file (CSV/XLSX)
 * 2. Validate each row
 * 3. Map valid rows to global products
 * 4. Create staged products
 * 5. Update upload job status
 */
export const processCatalogUpload = async (
  uploadJobId: mongoose.Types.ObjectId
): Promise<ProcessingResult> => {
  const uploadJob = await CatalogUploadJob.findById(uploadJobId);
  if (!uploadJob) {
    throw new Error('Upload job not found');
  }

  // Update status to processing
  uploadJob.status = 'processing';
  uploadJob.processingStartedAt = new Date();
  await uploadJob.save();

  const errors: Array<{ row: number; field?: string; message: string }> = [];
  const stagedProductIds: mongoose.Types.ObjectId[] = [];

  try {
    // Step 1: Parse file
    const filePath = uploadJob.fileUrl.startsWith('http') 
      ? uploadJob.fileUrl // If URL, would need to download first (S3/Cloudinary)
      : uploadJob.fileUrl; // Local file path

    // For local files, check if file exists
    if (!uploadJob.fileUrl.startsWith('http') && !fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Parse the file
    const parseResult = parseCatalogFile(filePath, uploadJob.fileType);
    
    if (parseResult.parseErrors.length > 0) {
      // File-level parsing errors
      parseResult.parseErrors.forEach(error => {
        errors.push({ row: 0, message: error });
      });
      
      uploadJob.status = 'validation_failed';
      uploadJob.errors = errors as any;
      uploadJob.completedAt = new Date();
      await uploadJob.save();
      
      return {
        success: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors,
        stagedProductIds: [],
      };
    }

    // Step 2: Validate rows
    const validationResults = await validateCatalogRows(
      parseResult.rows,
      uploadJob.storeId,
      uploadJob.supplierId
    );

    // Step 3: Map valid rows to global products
    const mappingResults = await mapCatalogRowsToProducts(
      validationResults,
      uploadJob.storeId,
      uploadJob.supplierId
    );

    // Step 4: Create staged products
    let validCount = 0;
    let invalidCount = 0;

    for (const { row, validation, mapping } of mappingResults) {
      const rowErrors: Array<{ field: string; message: string }> = [];
      
      // Collect validation errors
      if (!validation.isValid) {
        rowErrors.push(...validation.errors);
        invalidCount++;
      }

      // Collect mapping errors
      if (mapping.mappingErrors.length > 0) {
        mapping.mappingErrors.forEach(error => {
          rowErrors.push({ field: 'mapping', message: error });
        });
        invalidCount++;
      }

      // Create staged product
      const stagedProduct = new StagedProduct({
        uploadJobId: uploadJob._id,
        supplierId: uploadJob.supplierId,
        storeId: uploadJob.storeId,
        rowNumber: row.rowNumber,
        rawData: row.rawData,
        normalizedData: {
          productName: row.normalizedData.productName || '',
          sku: row.normalizedData.sku || '',
          brand: row.normalizedData.brand,
          brandId: mapping.brandId,
          category: row.normalizedData.category,
          categoryId: mapping.categoryId,
          variantAttributes: row.normalizedData.variantAttributes,
          costPrice: row.normalizedData.costPrice || 0,
          stock: row.normalizedData.stock || 0,
          minOrderQty: row.normalizedData.minOrderQty || 1,
          description: row.normalizedData.description,
          images: row.normalizedData.images || [],
        },
        validationErrors: rowErrors,
        status: rowErrors.length > 0 ? 'invalid' : 'valid',
        globalProductId: mapping.globalProductId,
        requiresApproval: mapping.requiresApproval,
      });

      await stagedProduct.save();
      stagedProductIds.push(stagedProduct._id);

      // Track errors for upload job
      if (rowErrors.length > 0) {
        rowErrors.forEach(error => {
          errors.push({
            row: row.rowNumber,
            field: error.field,
            message: error.message,
          });
        });
      } else {
        validCount++;
      }
    }

    // Step 5: Update upload job
    uploadJob.totalRows = parseResult.totalRows;
    uploadJob.validRows = validCount;
    uploadJob.invalidRows = invalidCount;
    uploadJob.errors = errors as any;

    if (invalidCount === parseResult.totalRows) {
      // All rows invalid
      uploadJob.status = 'validation_failed';
    } else if (validCount > 0) {
      // Has valid rows - ready for approval
      uploadJob.status = 'pending_approval';
    } else {
      uploadJob.status = 'validation_failed';
    }

    uploadJob.completedAt = new Date();
    await uploadJob.save();

    return {
      success: true,
      totalRows: parseResult.totalRows,
      validRows: validCount,
      invalidRows: invalidCount,
      errors,
      stagedProductIds,
    };
  } catch (error: any) {
    // Update job with error
    uploadJob.status = 'validation_failed';
    uploadJob.errors.push({
      row: 0,
      message: `Processing failed: ${error.message}`,
    });
    uploadJob.completedAt = new Date();
    await uploadJob.save();

    throw error;
  }
};

