import mongoose from 'mongoose';
import fs from 'fs';
import { PriceUpdateJob, IPriceUpdateJob } from '../models/PriceUpdateJob';
import { StagedPriceUpdate, IStagedPriceUpdate } from '../models/StagedPriceUpdate';
import { parsePriceUpdateFile, ParsedPriceUpdateRow } from './priceUpdateParser.service';
import { validatePriceUpdateRows, ValidationResult } from './priceUpdateValidation.service';

/**
 * Price Update Processing Service
 * 
 * PURPOSE:
 * - Orchestrates the price update processing pipeline
 * - Parses file → Validates rows → Creates staged price updates
 * - Updates job status and statistics
 */

export interface ProcessingResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  stagedUpdateIds: mongoose.Types.ObjectId[];
}

/**
 * Process a price update upload job
 * 
 * Flow:
 * 1. Parse file (CSV/XLSX)
 * 2. Validate each row (SKU exists, price valid)
 * 3. Create staged price updates
 * 4. Update upload job status
 */
export const processPriceUpdateUpload = async (
  updateJobId: mongoose.Types.ObjectId
): Promise<ProcessingResult> => {
  const updateJob = await PriceUpdateJob.findById(updateJobId);
  if (!updateJob) {
    throw new Error('Price update job not found');
  }

  // Update status to processing
  updateJob.status = 'processing';
  updateJob.processingStartedAt = new Date();
  await updateJob.save();

  const errors: Array<{ row: number; field?: string; message: string }> = [];
  const stagedUpdateIds: mongoose.Types.ObjectId[] = [];

  try {
    // Step 1: Parse file
    const filePath = updateJob.fileUrl.startsWith('http') 
      ? updateJob.fileUrl // If URL, would need to download first (S3/Cloudinary)
      : updateJob.fileUrl; // Local file path

    // For local files, check if file exists
    if (!updateJob.fileUrl.startsWith('http') && !fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Parse the file
    const parseResult = parsePriceUpdateFile(filePath, updateJob.fileType);
    
    if (parseResult.parseErrors.length > 0) {
      // File-level parsing errors
      parseResult.parseErrors.forEach(error => {
        errors.push({ row: 0, message: error });
      });
      
      updateJob.status = 'validation_failed';
      updateJob.errors = errors as any;
      updateJob.completedAt = new Date();
      await updateJob.save();
      
      return {
        success: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors,
        stagedUpdateIds: [],
      };
    }

    // Step 2: Validate rows
    const validationResults = await validatePriceUpdateRows(
      parseResult.rows,
      updateJob.storeId,
      updateJob.supplierId
    );

    // Step 3: Create staged price updates
    let validCount = 0;
    let invalidCount = 0;

    for (const { row, validation } of validationResults) {
      const rowErrors: Array<{ field: string; message: string }> = [];
      
      // Collect validation errors
      if (!validation.isValid) {
        rowErrors.push(...validation.errors);
        invalidCount++;
      }

      // Create staged price update
      const stagedUpdate = new StagedPriceUpdate({
        updateJobId: updateJob._id,
        supplierId: updateJob.supplierId,
        storeId: updateJob.storeId,
        rowNumber: row.rowNumber,
        rawData: row.rawData,
        normalizedData: {
          sku: row.normalizedData.sku || '',
          newPrice: row.normalizedData.newPrice || 0,
        },
        supplierProductId: validation.supplierProductId,
        oldPrice: validation.oldPrice,
        validationErrors: rowErrors,
        status: rowErrors.length > 0 ? 'invalid' : 'valid',
      });

      await stagedUpdate.save();
      stagedUpdateIds.push(stagedUpdate._id);

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

    // Step 4: Update upload job
    updateJob.totalRows = parseResult.totalRows;
    updateJob.validRows = validCount;
    updateJob.invalidRows = invalidCount;
    updateJob.errors = errors as any;

    if (invalidCount === parseResult.totalRows) {
      // All rows invalid
      updateJob.status = 'validation_failed';
    } else if (validCount > 0) {
      // Has valid rows - ready for approval (or auto-approve if configured)
      updateJob.status = 'pending_approval';
    } else {
      updateJob.status = 'validation_failed';
    }

    updateJob.completedAt = new Date();
    await updateJob.save();

    return {
      success: true,
      totalRows: parseResult.totalRows,
      validRows: validCount,
      invalidRows: invalidCount,
      errors,
      stagedUpdateIds,
    };
  } catch (error: any) {
    // Update job with error
    updateJob.status = 'validation_failed';
    updateJob.errors.push({
      row: 0,
      message: `Processing failed: ${error.message}`,
    });
    updateJob.completedAt = new Date();
    await updateJob.save();

    throw error;
  }
};

