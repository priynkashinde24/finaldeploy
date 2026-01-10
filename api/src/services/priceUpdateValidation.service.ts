import mongoose from 'mongoose';
import { SupplierProduct } from '../models/SupplierProduct';
import { ParsedPriceUpdateRow } from './priceUpdateParser.service';

/**
 * Price Update Validation Service
 * 
 * PURPOSE:
 * - Validate parsed price update rows
 * - Check SKU exists in supplier's products
 * - Validate price > 0
 * - Return validation errors per row
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  supplierProductId?: mongoose.Types.ObjectId;
  oldPrice?: number;
}

/**
 * Validate a single parsed row
 */
export const validatePriceUpdateRow = async (
  row: ParsedPriceUpdateRow,
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId
): Promise<ValidationResult> => {
  const errors: ValidationError[] = [];
  const { normalizedData } = row;
  
  // Required fields
  if (!normalizedData.sku || normalizedData.sku.trim() === '') {
    errors.push({ field: 'sku', message: 'SKU is required' });
    return { isValid: false, errors };
  }
  
  if (normalizedData.newPrice === undefined || normalizedData.newPrice === null) {
    errors.push({ field: 'newPrice', message: 'Price is required' });
    return { isValid: false, errors };
  }
  
  // Validate price > 0
  if (normalizedData.newPrice <= 0) {
    errors.push({ field: 'newPrice', message: 'Price must be greater than 0' });
  }
  
  // Check if SKU exists in supplier's products
  const supplierProduct = await SupplierProduct.findOne({
    storeId,
    supplierId,
    supplierSku: normalizedData.sku.toUpperCase(),
    status: 'active',
  });
  
  if (!supplierProduct) {
    errors.push({ field: 'sku', message: `SKU not found in your products: ${normalizedData.sku}` });
    return { isValid: false, errors };
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    supplierProductId: supplierProduct._id,
    oldPrice: supplierProduct.costPrice,
  };
};

/**
 * Validate multiple rows (batch validation)
 */
export const validatePriceUpdateRows = async (
  rows: ParsedPriceUpdateRow[],
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId
): Promise<Array<{ row: ParsedPriceUpdateRow; validation: ValidationResult }>> => {
  const results: Array<{ row: ParsedPriceUpdateRow; validation: ValidationResult }> = [];
  
  for (const row of rows) {
    const validation = await validatePriceUpdateRow(row, storeId, supplierId);
    results.push({ row, validation });
  }
  
  return results;
};

