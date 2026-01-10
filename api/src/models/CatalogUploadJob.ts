import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Catalog Upload Job Model
 * 
 * PURPOSE:
 * - Tracks bulk catalog uploads from suppliers
 * - One job = one file upload
 * - Tracks processing status and validation results
 * - Immutable once approved
 * 
 * STATUS FLOW:
 * uploaded → processing → validation_failed | pending_approval → approved | rejected
 */

export interface ICatalogUploadJob extends Omit<Document, 'errors'> {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  fileUrl: string; // URL to uploaded file (S3, Cloudinary, or local)
  fileName: string; // Original filename
  fileType: 'csv' | 'xlsx';
  status: 'uploaded' | 'processing' | 'validation_failed' | 'pending_approval' | 'approved' | 'rejected';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number; // Row number (1-indexed)
    field?: string; // Field name if applicable
    message: string; // Error message
  }>;
  processingStartedAt?: Date;
  completedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId; // Admin who approved
  rejectedBy?: mongoose.Types.ObjectId; // Admin who rejected
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CatalogUploadJobSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ['csv', 'xlsx'],
      required: true,
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'validation_failed', 'pending_approval', 'approved', 'rejected'],
      default: 'uploaded',
      index: true,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    validRows: {
      type: Number,
      default: 0,
    },
    invalidRows: {
      type: Number,
      default: 0,
    },
    errors: [{
      row: Number,
      field: String,
      message: String,
    }],
    processingStartedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
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
  { 
    timestamps: true,
    suppressReservedKeysWarning: true // Suppress warning for 'errors' field (reserved pathname)
  }
);

// Indexes
CatalogUploadJobSchema.index({ storeId: 1, supplierId: 1, status: 1 });
CatalogUploadJobSchema.index({ storeId: 1, status: 1, createdAt: -1 });
CatalogUploadJobSchema.index({ supplierId: 1, status: 1 });

// Pre-save hook: Prevent modification once approved
CatalogUploadJobSchema.pre('save', function (next) {
  if (this.isModified() && this.status === 'approved') {
    // Allow only status change to rejected (for rollback scenarios)
    const allowedFields = ['status', 'rejectedAt', 'rejectedBy', 'rejectionReason', 'updatedAt'];
    const modifiedFields = Object.keys(this.getChanges?.() || {});
    const hasDisallowedChanges = modifiedFields.some(field => !allowedFields.includes(field));
    
    if (hasDisallowedChanges) {
      return next(new Error('Cannot modify approved upload job'));
    }
  }
  next();
});

export const CatalogUploadJob: Model<ICatalogUploadJob> = 
  mongoose.models.CatalogUploadJob || mongoose.model<ICatalogUploadJob>('CatalogUploadJob', CatalogUploadJobSchema);

