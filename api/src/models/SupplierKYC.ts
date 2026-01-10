import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISupplierKYC extends Document {
  _id: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  businessName: string;
  gstNumber?: string;
  panNumber: string;
  aadhaarNumber: string; // Stored masked
  documents: {
    panCardUrl: string;
    aadhaarFrontUrl: string;
    aadhaarBackUrl: string;
    gstCertificateUrl?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  submittedAt: Date;
  reviewedAt?: Date | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierKYCSchema: Schema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      unique: true, // One KYC per supplier
      index: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [200, 'Business name must not exceed 200 characters'],
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format'],
    },
    panNumber: {
      type: String,
      required: [true, 'PAN number is required'],
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format'],
      index: true,
    },
    aadhaarNumber: {
      type: String,
      required: [true, 'Aadhaar number is required'],
      trim: true,
      // Store masked: first 4 and last 4 digits visible
      match: [/^\d{4}\*{4}\d{4}$/, 'Invalid Aadhaar number format'],
    },
    documents: {
      panCardUrl: {
        type: String,
        required: [true, 'PAN card document is required'],
      },
      aadhaarFrontUrl: {
        type: String,
        required: [true, 'Aadhaar front document is required'],
      },
      aadhaarBackUrl: {
        type: String,
        required: [true, 'Aadhaar back document is required'],
      },
      gstCertificateUrl: {
        type: String,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason must not exceed 500 characters'],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
SupplierKYCSchema.index({ supplierId: 1, status: 1 });
SupplierKYCSchema.index({ status: 1, submittedAt: -1 });

export const SupplierKYC: Model<ISupplierKYC> =
  mongoose.models.SupplierKYC || mongoose.model<ISupplierKYC>('SupplierKYC', SupplierKYCSchema);

