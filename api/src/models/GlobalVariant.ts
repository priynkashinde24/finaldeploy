import mongoose, { Schema, Document, Model } from 'mongoose';
import { ProductVariant, IProductVariant } from './ProductVariant';

/**
 * Global Variant Model (Alias for ProductVariant)
 * 
 * PURPOSE:
 * - Treat variants as atomic sellable units
 * - Source of truth for variant definitions
 * - No pricing or stock here (that's in inventory models)
 * 
 * DESIGN:
 * - ProductVariant is already the global variant model
 * - This file provides a clear alias and documentation
 * - Variant = smallest sellable unit
 */

// Re-export ProductVariant as GlobalVariant for clarity
export type IGlobalVariant = IProductVariant;
export const GlobalVariant: Model<IGlobalVariant> = ProductVariant;

/**
 * Helper to get variant by SKU
 */
export async function getGlobalVariantBySku(
  sku: string,
  storeId: mongoose.Types.ObjectId | string
): Promise<IGlobalVariant | null> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  return await ProductVariant.findOne({ storeId: storeObjId, sku, status: 'active' });
}

/**
 * Helper to get variants for a product
 */
export async function getGlobalVariantsByProduct(
  productId: mongoose.Types.ObjectId | string,
  storeId: mongoose.Types.ObjectId | string
): Promise<IGlobalVariant[]> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const productObjId = typeof productId === 'string' ? new mongoose.Types.ObjectId(productId) : productId;
  return await ProductVariant.find({ storeId: storeObjId, productId: productObjId, status: 'active' });
}

