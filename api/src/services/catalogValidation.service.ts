import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { StagedProduct, IStagedProduct } from '../models/StagedProduct';
import { ParsedCatalogRow } from './catalogParser.service';

/**
 * Catalog Validation Service
 * 
 * PURPOSE:
 * - Validate parsed catalog rows
 * - Check SKU uniqueness per supplier
 * - Validate cost price, stock, category, brand
 * - Return validation errors per row
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a single parsed row
 */
export const validateCatalogRow = async (
  row: ParsedCatalogRow,
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId,
  existingSkus: Set<string> // SKUs already seen in this upload
): Promise<ValidationResult> => {
  const errors: ValidationError[] = [];
  const { normalizedData } = row;
  
  // Required fields
  if (!normalizedData.productName || normalizedData.productName.trim() === '') {
    errors.push({ field: 'productName', message: 'Product name is required' });
  }
  
  if (!normalizedData.sku || normalizedData.sku.trim() === '') {
    errors.push({ field: 'sku', message: 'SKU is required' });
  } else {
    // Check SKU uniqueness within this upload
    if (existingSkus.has(normalizedData.sku.toUpperCase())) {
      errors.push({ field: 'sku', message: `Duplicate SKU in upload: ${normalizedData.sku}` });
    } else {
      existingSkus.add(normalizedData.sku.toUpperCase());
      
      // Check SKU uniqueness per supplier (in existing staged products that are not rejected)
      const existingStaged = await StagedProduct.findOne({
        storeId,
        supplierId,
        'normalizedData.sku': normalizedData.sku.toUpperCase(),
        status: { $in: ['valid', 'approved'] },
      });
      
      if (existingStaged) {
        errors.push({ field: 'sku', message: `SKU already exists in pending uploads: ${normalizedData.sku}` });
      }
    }
  }
  
  // Validate cost price
  if (normalizedData.costPrice === undefined || normalizedData.costPrice === null) {
    errors.push({ field: 'costPrice', message: 'Cost price is required' });
  } else if (normalizedData.costPrice <= 0) {
    errors.push({ field: 'costPrice', message: 'Cost price must be greater than 0' });
  }
  
  // Validate stock
  if (normalizedData.stock === undefined || normalizedData.stock === null) {
    errors.push({ field: 'stock', message: 'Stock is required' });
  } else if (normalizedData.stock < 0) {
    errors.push({ field: 'stock', message: 'Stock must be non-negative' });
  }
  
  // Validate category (if provided)
  if (normalizedData.category) {
    const category = await Category.findOne({
      name: { $regex: new RegExp(`^${normalizedData.category.trim()}$`, 'i') },
      status: 'active',
    });
    
    if (!category) {
      errors.push({ field: 'category', message: `Category not found: ${normalizedData.category}` });
    }
  } else {
    errors.push({ field: 'category', message: 'Category is required' });
  }
  
  // Validate brand (if provided) - mark as pending if not found
  if (normalizedData.brand) {
    const brand = await Brand.findOne({
      name: { $regex: new RegExp(`^${normalizedData.brand.trim()}$`, 'i') },
      status: 'active',
    });
    
    // Brand not found is not an error - it will be marked for approval
    // We'll handle this in the mapping service
  }
  
  // Validate minOrderQty (if provided)
  if (normalizedData.minOrderQty !== undefined && normalizedData.minOrderQty < 1) {
    errors.push({ field: 'minOrderQty', message: 'Minimum order quantity must be at least 1' });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate multiple rows (batch validation)
 */
export const validateCatalogRows = async (
  rows: ParsedCatalogRow[],
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId
): Promise<Array<{ row: ParsedCatalogRow; validation: ValidationResult }>> => {
  const existingSkus = new Set<string>();
  const results: Array<{ row: ParsedCatalogRow; validation: ValidationResult }> = [];
  
  for (const row of rows) {
    const validation = await validateCatalogRow(row, storeId, supplierId, existingSkus);
    results.push({ row, validation });
  }
  
  return results;
};

