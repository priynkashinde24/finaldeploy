import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Supplier Product Mapping Model
 * 
 * PURPOSE:
 * - Maps supplier inventory to global products
 * - Stores supplier-specific data: cost price, stock, supplier SKU
 * - Supplier cannot create products, only map inventory to existing products
 * 
 * OWNERSHIP:
 * - Supplier owns this mapping (supplierId)
 * - References global Product (productId)
 * - Optionally references ProductVariant (variantId)
 * 
 * DESIGN DECISIONS:
 * - No product creation here (products are created by admin)
 * - Stock/quantity is supplier-specific (not in global Product)
 * - Cost price is supplier-specific (not in global Product)
 * - One supplier can map to many products (one-to-many)
 * - One product can be mapped by many suppliers (many-to-many via multiple SupplierProduct records)
 * 
 * STATUS FLOW:
 * - Product must be active
 * - SupplierProduct must be active AND stock > 0
 * - Only then is product available from this supplier
 */

export interface ISupplierProduct extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  supplierId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId; // Optional: for variant-specific inventory
  supplierSku: string; // Supplier's own SKU for this product
  costPrice: number; // Supplier's cost price (what supplier pays/charges)
  stockQuantity: number; // Available stock
  minOrderQty: number; // Minimum order quantity
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const SupplierProductSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
      // Optional: Only if supplier is mapping variant-specific inventory
    },
    supplierSku: {
      type: String,
      required: [true, 'Supplier SKU is required'],
      trim: true,
      uppercase: true,
      // Unique per supplier (not globally unique)
    },
    costPrice: {
      type: Number,
      required: [true, 'Cost price is required'],
      min: [0, 'Cost price must be non-negative'],
      // Supplier's cost price (what they charge resellers)
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity must be non-negative'],
      default: 0,
    },
    minOrderQty: {
      type: Number,
      required: [true, 'Minimum order quantity is required'],
      min: [1, 'Minimum order quantity must be at least 1'],
      default: 1,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One supplier cannot map same product+variant twice per store
SupplierProductSchema.index(
  { storeId: 1, supplierId: 1, productId: 1, variantId: 1 },
  { unique: true, sparse: true }
);

// Compound indexes for common queries (storeId is primary filter)
SupplierProductSchema.index({ storeId: 1, supplierId: 1, status: 1, stockQuantity: 1 });
SupplierProductSchema.index({ storeId: 1, productId: 1, status: 1 });
SupplierProductSchema.index({ storeId: 1, status: 1, stockQuantity: 1 }); // Used for queries with stockQuantity > 0

// Validation: Ensure product exists and is active
SupplierProductSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('productId')) {
    const { Product } = await import('./Product');
    const product = await Product.findById(this.productId);
    if (!product) {
      return next(new Error('Product not found'));
    }
    if (product.status !== 'active') {
      return next(new Error('Cannot map inventory to inactive product'));
    }
  }

  // If variantId is provided, ensure variant exists and is active
  if (this.variantId) {
    const { ProductVariant } = await import('./ProductVariant');
    const variant = await ProductVariant.findById(this.variantId);
    if (!variant) {
      return next(new Error('Product variant not found'));
    }
    if (variant.status !== 'active') {
      return next(new Error('Cannot map inventory to inactive variant'));
    }
    // Ensure variant belongs to the product
    if (variant.productId.toString() !== this.productId.toString()) {
      return next(new Error('Variant does not belong to the specified product'));
    }
  }

  next();
});

export const SupplierProduct: Model<ISupplierProduct> = mongoose.model<ISupplierProduct>(
  'SupplierProduct',
  SupplierProductSchema
);

