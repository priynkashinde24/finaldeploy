import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Staged Product Model
 * 
 * PURPOSE:
 * - Holds product data from catalog uploads before approval
 * - Never writes directly to live catalog
 * - Admin/supplier reviews staged data first
 * - Maps to Global Product Base after approval
 * 
 * STATUS FLOW:
 * valid | invalid → approved | rejected
 */

export interface IStagedProduct extends Document {
  _id: mongoose.Types.ObjectId;
  uploadJobId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  rowNumber: number; // Row number in original file (1-indexed)
  rawData: Record<string, any>; // Original row data from file
  normalizedData: {
    productName: string;
    sku: string;
    brand?: string;
    brandId?: mongoose.Types.ObjectId;
    category?: string;
    categoryId?: mongoose.Types.ObjectId;
    variantAttributes?: Record<string, any>;
    costPrice: number;
    stock: number;
    minOrderQty?: number;
    description?: string;
    images?: string[];
  };
  validationErrors: Array<{
    field: string;
    message: string;
  }>;
  status: 'valid' | 'invalid' | 'approved' | 'rejected';
  globalProductId?: mongoose.Types.ObjectId; // Mapped to existing product (if found)
  requiresApproval: boolean; // True if new global product needs to be created
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StagedProductSchema: Schema = new Schema(
  {
    uploadJobId: {
      type: Schema.Types.ObjectId,
      ref: 'CatalogUploadJob',
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    rowNumber: {
      type: Number,
      required: true,
    },
    rawData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    normalizedData: {
      productName: { type: String, required: true },
      sku: { type: String, required: true, uppercase: true },
      brand: { type: String },
      brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
      category: { type: String },
      categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
      variantAttributes: { type: Schema.Types.Mixed },
      costPrice: { type: Number, required: true, min: 0 },
      stock: { type: Number, required: true, min: 0, default: 0 },
      minOrderQty: { type: Number, min: 1, default: 1 },
      description: { type: String },
      images: [String],
    },
    validationErrors: [{
      field: String,
      message: String,
    }],
    status: {
      type: String,
      enum: ['valid', 'invalid', 'approved', 'rejected'],
      default: 'valid',
      index: true,
    },
    globalProductId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    requiresApproval: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes
StagedProductSchema.index({ uploadJobId: 1, status: 1 });
StagedProductSchema.index({ storeId: 1, supplierId: 1, status: 1 });
StagedProductSchema.index({ storeId: 1, status: 1, requiresApproval: 1 });
StagedProductSchema.index({ supplierId: 1, sku: 1 }); // For SKU uniqueness check per supplier

export const StagedProduct: Model<IStagedProduct> = 
  mongoose.models.StagedProduct || mongoose.model<IStagedProduct>('StagedProduct', StagedProductSchema);

