import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Global Product Model
 * 
 * PURPOSE:
 * - Single source of truth for all products in the system
 * - Created ONLY by admins
 * - Referenced by suppliers (for inventory) and resellers (for selling)
 * - Prevents product duplication across suppliers/resellers
 * 
 * OWNERSHIP:
 * - Admin owns and creates all products
 * - Suppliers map their inventory to global products (via SupplierProduct)
 * - Resellers map their pricing to global products (via ResellerProduct)
 * 
 * DESIGN DECISIONS:
 * - No supplier-specific data here (that's in SupplierProduct)
 * - No stock/quantity here (that's in SupplierProduct)
 * - No reseller pricing here (that's in ResellerProduct)
 * - basePrice is admin-defined reference price, not actual selling price
 * 
 * CATEGORY LINK:
 * - Product belongs to ONE primary category (categoryId)
 * - Optional subcategory (subCategoryId) for finer classification
 * - Category defines which attributes are available for this product
 * - Products in inactive categories are hidden from display
 * 
 * DATA FLOW:
 * Category → defines → Attributes (via applicableCategories)
 * Product → belongs to → Category
 * Variant → uses → Attributes (from product's category)
 * 
 * FUTURE EXTENSIONS:
 * - GST/tax slabs (can add taxCategory field)
 * - Shipping weight (can add weight field)
 * - Multi-warehouse (can add warehouseId array)
 * - SEO metadata (can add seo object with title, description, keywords)
 */

export interface IProduct extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  name: string;
  slug: string;
  description?: string;
  categoryId: mongoose.Types.ObjectId; // Primary category (required)
  subCategoryId?: mongoose.Types.ObjectId; // Optional subcategory
  brandId?: mongoose.Types.ObjectId; // Brand reference (optional, for brand-level markup)
  brand?: string; // Legacy: keep for backward compatibility
  images: string[];
  basePrice: number; // Admin-defined reference price (not actual selling price)
  taxCategoryId?: mongoose.Types.ObjectId; // Tax category for this product
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId; // Admin who created this product
  createdAt: Date;
  updatedAt: Date;
  // Legacy properties for backward compatibility
  supplierId?: string;
  sku?: string;
  price?: number;
  cost?: number;
  quantity?: number;
  category?: string;
  attributes?: Record<string, any>;
}

const ProductSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name must not exceed 200 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'],
      index: true,
      // Unique per store (enforced via compound index)
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description must not exceed 5000 characters'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
      index: true,
      // Product belongs to ONE primary category
      // Category defines which attributes are available for this product
    },
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
      // Optional subcategory for finer classification
      // Must be a subcategory of categoryId
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [100, 'Brand name must not exceed 100 characters'],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (images: string[]) => images.length <= 10,
        message: 'Maximum 10 images allowed',
      },
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price must be non-negative'],
      // This is admin-defined reference price
      // Actual selling prices are in SupplierProduct (costPrice) and ResellerProduct (sellingPrice)
    },
    taxCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'TaxCategory',
      default: null,
      index: true,
      // Optional: If not set, tax will be resolved from category or global default
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
      // Only admins can create products
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries (storeId is primary filter)
ProductSchema.index({ storeId: 1, status: 1 }); // Primary: Get products by store
ProductSchema.index({ storeId: 1, status: 1, categoryId: 1 }); // Get products by store and category
ProductSchema.index({ storeId: 1, categoryId: 1, subCategoryId: 1, status: 1 }); // Get products by store, category/subcategory
ProductSchema.index({ storeId: 1, brandId: 1, status: 1 }); // Get products by store and brand
ProductSchema.index({ storeId: 1, createdBy: 1, status: 1 }); // Get products by store and creator
ProductSchema.index({ storeId: 1, slug: 1 }, { unique: true }); // Unique slug per store

// Text search index for product search
ProductSchema.index({ name: 'text', description: 'text', brand: 'text' });

// Validation: Ensure category exists and is active
ProductSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('categoryId')) {
    const { Category } = await import('./Category');
    const category = await Category.findById(this.categoryId);
    if (!category) {
      return next(new Error('Category not found'));
    }
    if (category.status !== 'active') {
      return next(new Error('Cannot assign product to inactive category'));
    }
  }

  // Validate subcategory if provided
  if (this.subCategoryId) {
    const { Category } = await import('./Category');
    const subCategory = await Category.findById(this.subCategoryId);
    if (!subCategory) {
      return next(new Error('Subcategory not found'));
    }
    if (subCategory.status !== 'active') {
      return next(new Error('Cannot assign product to inactive subcategory'));
    }
    // Ensure subcategory is actually a subcategory of categoryId
    if (subCategory.parentId?.toString() !== this.categoryId.toString()) {
      return next(new Error('Subcategory must be a child of the primary category'));
    }
  }

  next();
});

export const Product: Model<IProduct> = mongoose.model<IProduct>('Product', ProductSchema);
