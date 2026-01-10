import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Tax Category Model
 * 
 * PURPOSE:
 * - Define tax rates (GST/VAT) for products
 * - Map tax categories to product categories
 * - Support invoice-ready tax calculation
 * 
 * RULES:
 * - One active tax per category (can have multiple inactive)
 * - Global fallback allowed (no category restriction)
 * - Tax rates are immutable once used in orders
 */

export interface ITaxCategory extends Document {
  name: string; // e.g., "GST 18%", "VAT 20%"
  taxType: 'gst' | 'vat'; // Tax system type
  taxRate: number; // Tax rate percentage (e.g., 18, 5, 12)
  applicableCategories: mongoose.Types.ObjectId[]; // Array of Category IDs this tax applies to
  isGlobal: boolean; // If true, applies to all products (fallback)
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId; // Admin who created this tax category
  createdAt: Date;
  updatedAt: Date;
}

const TaxCategorySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Tax category name is required'],
      trim: true,
      maxlength: [100, 'Tax category name must not exceed 100 characters'],
    },
    taxType: {
      type: String,
      enum: ['gst', 'vat'],
      required: [true, 'Tax type is required'],
      index: true,
    },
    taxRate: {
      type: Number,
      required: [true, 'Tax rate is required'],
      min: [0, 'Tax rate must be non-negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    applicableCategories: {
      type: [Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
      // Empty array means no category restriction (global fallback)
      // If populated, tax applies only to products in these categories
    },
    isGlobal: {
      type: Boolean,
      default: false,
      index: true,
      // If true, this is a global fallback tax (applies when no category-specific tax found)
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
TaxCategorySchema.index({ status: 1, isGlobal: 1 });
TaxCategorySchema.index({ status: 1, applicableCategories: 1 });
TaxCategorySchema.index({ taxType: 1, status: 1 });

// Validation: Ensure at least one global tax exists when creating global tax
TaxCategorySchema.pre('save', async function (next) {
  if (this.isNew && this.isGlobal && this.status === 'active') {
    const existingGlobal = await TaxCategory.findOne({
      isGlobal: true,
      status: 'active',
      _id: { $ne: this._id },
    });
    // Allow multiple global taxes, but typically only one should be active
  }
  next();
});

export const TaxCategory: Model<ITaxCategory> =
  mongoose.models.TaxCategory || mongoose.model<ITaxCategory>('TaxCategory', TaxCategorySchema);


