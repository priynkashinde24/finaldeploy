import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Staged Price Update Model
 * 
 * PURPOSE:
 * - Holds price update data before approval
 * - Links to existing SupplierProduct records
 * - Tracks old price vs new price
 * - Admin/supplier reviews before applying
 */

export interface IStagedPriceUpdate extends Document {
  _id: mongoose.Types.ObjectId;
  updateJobId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  rowNumber: number; // Row number in original file (1-indexed)
  rawData: Record<string, any>; // Original row data from file
  normalizedData: {
    sku: string;
    newPrice: number;
  };
  supplierProductId?: mongoose.Types.ObjectId; // Link to existing SupplierProduct
  oldPrice?: number; // Current price before update
  validationErrors: Array<{
    field: string;
    message: string;
  }>;
  status: 'valid' | 'invalid' | 'approved' | 'rejected';
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StagedPriceUpdateSchema: Schema = new Schema(
  {
    updateJobId: {
      type: Schema.Types.ObjectId,
      ref: 'PriceUpdateJob',
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
      sku: { type: String, required: true, uppercase: true },
      newPrice: { type: Number, required: true, min: 0 },
    },
    supplierProductId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierProduct',
      default: null,
    },
    oldPrice: {
      type: Number,
      min: 0,
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
StagedPriceUpdateSchema.index({ updateJobId: 1, status: 1 });
StagedPriceUpdateSchema.index({ storeId: 1, supplierId: 1, status: 1 });
StagedPriceUpdateSchema.index({ supplierProductId: 1 });

export const StagedPriceUpdate: Model<IStagedPriceUpdate> = 
  mongoose.models.StagedPriceUpdate || mongoose.model<IStagedPriceUpdate>('StagedPriceUpdate', StagedPriceUpdateSchema);

