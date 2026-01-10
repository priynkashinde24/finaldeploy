import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IResellerCatalog extends Document {
  resellerId: string;
  supplierProductId: string;
  resellerPrice: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ResellerCatalogSchema: Schema = new Schema(
  {
    resellerId: {
      type: String,
      required: [true, 'Reseller ID is required'],
      trim: true,
      index: true,
    },
    supplierProductId: {
      type: String,
      required: [true, 'Supplier Product ID is required'],
      trim: true,
      index: true,
    },
    resellerPrice: {
      type: Number,
      required: [true, 'Reseller price is required'],
      min: [0, 'Reseller price must be greater than or equal to 0'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate entries
ResellerCatalogSchema.index({ resellerId: 1, supplierProductId: 1 }, { unique: true });

export const ResellerCatalog: Model<IResellerCatalog> =
  mongoose.models.ResellerCatalog ||
  mongoose.model<IResellerCatalog>('ResellerCatalog', ResellerCatalogSchema);

