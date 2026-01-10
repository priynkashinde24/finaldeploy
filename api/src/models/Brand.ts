import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Brand Model
 * 
 * PURPOSE:
 * - Admin-defined product brands
 * - Used for brand-level markup policies
 * - Each product belongs to one brand
 * - Brands can be active or inactive
 * 
 * RULES:
 * - Brands created by admin only
 * - Inactive brands hide from product creation
 * - Brand name and slug must be unique
 */

export interface IBrand extends Document {
  name: string; // Brand name (unique)
  slug: string; // URL-friendly slug (unique)
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId; // Admin who created this brand
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Brand name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Brand name must not exceed 100 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Brand slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'],
      index: true,
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
      required: [true, 'Created by (admin) is required'],
      // Only admins can create brands
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
BrandSchema.index({ status: 1, name: 1 }); // Get active brands sorted by name

// Pre-save hook: Generate slug from name if not provided
BrandSchema.pre('save', function (next) {
  if (this.isNew && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

export const Brand: Model<IBrand> =
  mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema);

