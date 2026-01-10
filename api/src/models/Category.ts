import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Category Model (Hierarchical)
 * 
 * PURPOSE:
 * - Organizes products into hierarchical categories (e.g., Electronics > Mobile > Smartphones)
 * - Admin-only creation and management
 * - Supports unlimited nesting levels
 * - Inactive categories hide their products from display
 * 
 * WHY HIERARCHICAL:
 * - Products belong to categories (e.g., "Electronics > Mobile > Smartphones")
 * - Categories define which attributes are applicable (e.g., Mobile category has "Screen Size", "RAM", etc.)
 * - Subcategories inherit parent category attributes
 * - Enables better product organization and filtering
 * 
 * DATA FLOW:
 * Category → defines → Attributes (via applicableCategories)
 * Product → belongs to → Category
 * Variant → uses → Attributes (from product's category)
 * 
 * RULES:
 * - Categories are admin-only (createdBy field)
 * - Support unlimited nesting (parentId can reference another Category)
 * - Level 0 = root category (no parent)
 * - Inactive categories hide products (status check in queries)
 * - Slug must be unique (for SEO-friendly URLs)
 */

export interface ICategory extends Document {
  name: string;
  slug: string;
  parentId: mongoose.Types.ObjectId | null;
  level: number; // 0 = root, 1 = subcategory, 2 = sub-subcategory, etc.
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId; // Admin who created this category
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name must not exceed 100 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'],
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      // null = root category (level 0)
      // ObjectId = subcategory (references parent category)
      index: true,
    },
    level: {
      type: Number,
      required: [true, 'Category level is required'],
      min: [0, 'Category level must be at least 0'],
      default: 0,
      // 0 = root category
      // 1 = first-level subcategory
      // 2 = second-level subcategory, etc.
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
      // Inactive categories hide products from display
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by (admin) is required'],
      // Only admins can create categories
    },
  },
  {
    timestamps: true,
  }
);

// Unique index on slug (already defined in schema, but explicit for clarity)
CategorySchema.index({ slug: 1 }, { unique: true });

// Compound indexes for common queries
CategorySchema.index({ parentId: 1, status: 1 }); // Get subcategories of a parent
CategorySchema.index({ level: 1, status: 1 }); // Get all categories at a level
CategorySchema.index({ status: 1, level: 1 }); // Get active categories by level

// Validation: Ensure parent exists and calculate level
CategorySchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('parentId')) {
    if (this.parentId) {
      // Subcategory: verify parent exists and is active
      const parent = await mongoose.model<ICategory>('Category').findById(this.parentId);
      if (!parent) {
        return next(new Error('Parent category not found'));
      }
      if (parent.status !== 'active') {
        return next(new Error('Cannot create subcategory under inactive parent'));
      }
      // Calculate level: parent level + 1
      this.level = parent.level + 1;
    } else {
      // Root category: level is 0
      this.level = 0;
    }
  }
  next();
});

// Prevent circular references (category cannot be its own parent or descendant)
CategorySchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('parentId')) {
    if (this.parentId && this._id) {
      // Check if parentId is the same as _id (self-reference)
      if (this.parentId.toString() === this._id.toString()) {
        return next(new Error('Category cannot be its own parent'));
      }
      
      // Check for circular reference (parent's parent chain)
      let currentParentId = this.parentId;
      const visited = new Set<string>();
      
      while (currentParentId) {
        if (visited.has(currentParentId.toString())) {
          return next(new Error('Circular reference detected in category hierarchy'));
        }
        if (currentParentId.toString() === this._id.toString()) {
          return next(new Error('Circular reference detected: category cannot be ancestor of itself'));
        }
        visited.add(currentParentId.toString());
        
        const parent = await mongoose.model<ICategory>('Category').findById(currentParentId);
        if (!parent || !parent.parentId) {
          break;
        }
        currentParentId = parent.parentId;
      }
    }
  }
  next();
});

export const Category: Model<ICategory> = mongoose.model<ICategory>('Category', CategorySchema);

