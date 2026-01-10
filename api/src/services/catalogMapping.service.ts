import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { ParsedCatalogRow } from './catalogParser.service';
import { ValidationResult } from './catalogValidation.service';

/**
 * Catalog Mapping Service
 * 
 * PURPOSE:
 * - Map supplier catalog rows to Global Product Base
 * - If product exists → map supplier variant
 * - Else → mark as "new global product request"
 */

export interface MappingResult {
  globalProductId?: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  brandId?: mongoose.Types.ObjectId;
  requiresApproval: boolean; // True if new global product needs to be created
  mappingErrors: string[];
}

/**
 * Map a validated row to Global Product Base
 */
export const mapCatalogRowToProduct = async (
  row: ParsedCatalogRow,
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId
): Promise<MappingResult> => {
  const mappingErrors: string[] = [];
  const { normalizedData } = row;
  
  let globalProductId: mongoose.Types.ObjectId | undefined;
  let categoryId: mongoose.Types.ObjectId | undefined;
  let brandId: mongoose.Types.ObjectId | undefined;
  let requiresApproval = false;
  
  // Find category
  if (normalizedData.category) {
    const category = await Category.findOne({
      name: { $regex: new RegExp(`^${normalizedData.category.trim()}$`, 'i') },
      status: 'active',
    });
    
    if (category) {
      categoryId = category._id;
    } else {
      mappingErrors.push(`Category not found: ${normalizedData.category}`);
    }
  }
  
  // Find brand (optional)
  if (normalizedData.brand) {
    const brand = await Brand.findOne({
      name: { $regex: new RegExp(`^${normalizedData.brand.trim()}$`, 'i') },
      status: 'active',
    });
    
    if (brand) {
      brandId = brand._id;
    } else {
      // Brand not found - mark for approval (admin will create brand)
      requiresApproval = true;
    }
  }
  
  // Try to find existing product by name + category (fuzzy match)
  if (normalizedData.productName && categoryId) {
    const existingProduct = await Product.findOne({
      storeId,
      name: { $regex: new RegExp(`^${normalizedData.productName.trim()}$`, 'i') },
      categoryId,
      status: 'active',
    });
    
    if (existingProduct) {
      globalProductId = existingProduct._id;
    } else {
      // Product not found - mark for approval (admin will create product)
      requiresApproval = true;
    }
  } else {
    requiresApproval = true;
  }
  
  return {
    globalProductId,
    categoryId,
    brandId,
    requiresApproval,
    mappingErrors,
  };
};

/**
 * Map multiple rows (batch mapping)
 */
export const mapCatalogRowsToProducts = async (
  rows: Array<{ row: ParsedCatalogRow; validation: ValidationResult }>,
  storeId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId
): Promise<Array<{ row: ParsedCatalogRow; validation: ValidationResult; mapping: MappingResult }>> => {
  const results: Array<{ row: ParsedCatalogRow; validation: ValidationResult; mapping: MappingResult }> = [];
  
  for (const { row, validation } of rows) {
    // Only map if validation passed
    if (validation.isValid) {
      const mapping = await mapCatalogRowToProduct(row, storeId, supplierId);
      results.push({ row, validation, mapping });
    } else {
      // Invalid rows don't need mapping
      results.push({ row, validation, mapping: { requiresApproval: false, mappingErrors: [] } });
    }
  }
  
  return results;
};

