import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Reseller Product Mapping Model
 * 
 * PURPOSE:
 * - Maps reseller pricing to global products
 * - Reseller selects supplier product and sets margin
 * - Syncs stock, cost, and status from supplier
 * - Enforces pricing rules & markup
 * - Prevents overselling and stale data
 * 
 * OWNERSHIP:
 * - Reseller owns this mapping (resellerId)
 * - References global Product (productId = globalProductId)
 * - References ProductVariant (variantId = globalVariantId)
 * - References SupplierProduct (supplierProductId)
 * - References SupplierProduct variant (supplierVariantId)
 * 
 * DESIGN DECISIONS:
 * - No product creation here (products are created by admin)
 * - Stock is always derived from supplier (syncedStock)
 * - Reseller never edits supplier cost (supplierCost is read-only)
 * - One reseller product per supplier variant (unique constraint)
 * - Stock source is always "supplier"
 * 
 * PRICING LOGIC:
 * - resellerPrice = supplierCost * (1 + margin/100)
 * - Margin is percentage (e.g., 20 = 20% markup)
 * 
 * SYNC LOGIC:
 * - Stock synced from SupplierProduct.stockQuantity
 * - Cost synced from SupplierProduct.costPrice
 * - Status synced based on supplier stock (0 stock = inactive)
 * - lastSyncedAt tracks sync timestamp
 * 
 * STATUS FLOW:
 * - Product must be active
 * - SupplierProduct must be active
 * - If supplier stock = 0 → reseller product inactive
 * - Automatically re-activate when stock returns
 */

export interface IResellerProduct extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  resellerId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId; // Which supplier this reseller is sourcing from
  
  // Global product references
  globalProductId: mongoose.Types.ObjectId; // References Product (same as productId for backward compat)
  globalVariantId?: mongoose.Types.ObjectId; // References ProductVariant (same as variantId for backward compat)
  
  // Supplier product references
  supplierProductId: mongoose.Types.ObjectId; // References SupplierProduct
  supplierVariantId?: mongoose.Types.ObjectId; // Variant ID from SupplierProduct (for clarity)
  
  // Pricing
  supplierCost: number; // Supplier's cost price (read-only, synced from SupplierProduct)
  resellerPrice: number; // Reseller's selling price to customers (same as sellingPrice for backward compat)
  margin: number; // Margin percentage (e.g., 20 = 20% markup)
  
  // Stock & sync
  stockSource: 'supplier'; // Always "supplier" - stock is derived from supplier
  syncedStock: number; // Stock synced from SupplierProduct.stockQuantity
  isActive: boolean; // Active status (derived from status field for backward compat)
  lastSyncedAt: Date; // Timestamp of last sync from supplier
  
  // Legacy fields (for backward compatibility)
  productId?: mongoose.Types.ObjectId; // Same as globalProductId
  variantId?: mongoose.Types.ObjectId; // Same as globalVariantId
  sellingPrice?: number; // Same as resellerPrice
  status: 'active' | 'inactive'; // Status enum (maps to isActive)
  
  createdAt: Date;
  updatedAt: Date;
}

const ResellerProductSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    resellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reseller ID is required'],
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      index: true,
      // Which supplier this reseller is sourcing from
    },
    
    // Global product references
    globalProductId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Global product ID is required'],
      index: true,
    },
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
      index: true,
      // Optional: Only if reseller is pricing variant-specific product
    },
    
    // Supplier product references
    supplierProductId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierProduct',
      required: [true, 'Supplier product ID is required'],
      index: true,
    },
    supplierVariantId: {
      type: Schema.Types.ObjectId,
      default: null,
      // Variant ID from SupplierProduct (for clarity)
    },
    
    // Pricing
    supplierCost: {
      type: Number,
      required: [true, 'Supplier cost is required'],
      min: [0, 'Supplier cost must be non-negative'],
      // Supplier's cost price (read-only, synced from SupplierProduct)
    },
    resellerPrice: {
      type: Number,
      required: [true, 'Reseller price is required'],
      min: [0, 'Reseller price must be non-negative'],
      // Reseller's selling price to end customers
    },
    margin: {
      type: Number,
      required: [true, 'Margin is required'],
      min: [0, 'Margin must be non-negative'],
      max: [1000, 'Margin must not exceed 1000%'],
      // Margin percentage (e.g., 20 = 20% markup)
    },
    
    // Stock & sync
    stockSource: {
      type: String,
      enum: ['supplier'],
      default: 'supplier',
      // Always "supplier" - stock is derived from supplier
    },
    syncedStock: {
      type: Number,
      required: [true, 'Synced stock is required'],
      min: [0, 'Synced stock must be non-negative'],
      default: 0,
      // Stock synced from SupplierProduct.stockQuantity
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
      // Active status (synced based on supplier stock)
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
      index: true,
      // Timestamp of last sync from supplier
    },
    
    // Legacy fields (for backward compatibility)
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      // Same as globalProductId (set via virtual or pre-save)
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
      // Same as globalVariantId (set via virtual or pre-save)
    },
    sellingPrice: {
      type: Number,
      // Same as resellerPrice (set via virtual or pre-save)
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
      // Status enum (maps to isActive)
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One reseller product per supplier variant per store
ResellerProductSchema.index(
  { storeId: 1, resellerId: 1, supplierProductId: 1, supplierVariantId: 1 },
  { unique: true, sparse: true }
);

// Legacy unique constraint (for backward compatibility)
ResellerProductSchema.index(
  { storeId: 1, resellerId: 1, productId: 1, variantId: 1, supplierId: 1 },
  { unique: true, sparse: true }
);

// Compound indexes for common queries (storeId is primary filter)
ResellerProductSchema.index({ storeId: 1, resellerId: 1, isActive: 1 });
ResellerProductSchema.index({ storeId: 1, resellerId: 1, status: 1 }); // Legacy
ResellerProductSchema.index({ storeId: 1, globalProductId: 1, isActive: 1 });
ResellerProductSchema.index({ storeId: 1, productId: 1, status: 1 }); // Legacy
ResellerProductSchema.index({ storeId: 1, supplierId: 1, isActive: 1 });
ResellerProductSchema.index({ storeId: 1, supplierId: 1, status: 1 }); // Legacy
ResellerProductSchema.index({ storeId: 1, supplierProductId: 1 });
ResellerProductSchema.index({ storeId: 1, lastSyncedAt: 1 });

// Note: productId, variantId, and sellingPrice are real fields in the schema
// They are synced from globalProductId, globalVariantId, and resellerPrice via pre-save middleware
// No virtuals needed - using real fields for backward compatibility

// Pre-save middleware: Sync legacy fields and validate
ResellerProductSchema.pre('save', async function (next) {
  // Sync legacy fields for backward compatibility
  if (this.globalProductId && !this.productId) {
    this.productId = this.globalProductId;
  }
  if (this.globalVariantId && !this.variantId) {
    this.variantId = this.globalVariantId;
  }
  if (this.resellerPrice && !this.sellingPrice) {
    this.sellingPrice = this.resellerPrice;
  }
  
  // Sync isActive with status
  if (this.status === 'active') {
    this.isActive = true;
  } else if (this.status === 'inactive') {
    this.isActive = false;
  } else if (this.isActive !== undefined) {
    this.status = this.isActive ? 'active' : 'inactive';
  }

  // Validate global product exists and is active
  const productId = this.globalProductId || this.productId;
  if (productId && (this.isNew || this.isModified('globalProductId') || this.isModified('productId'))) {
    const { Product } = await import('./Product');
    const product = await Product.findById(productId);
    if (!product) {
      return next(new Error('Product not found'));
    }
    if (product.status !== 'active') {
      return next(new Error('Cannot list inactive product'));
    }
  }

  // Validate variant if provided
  const variantId = this.globalVariantId || this.variantId;
  if (variantId && (this.isNew || this.isModified('globalVariantId') || this.isModified('variantId'))) {
    const { ProductVariant } = await import('./ProductVariant');
    const variant = await ProductVariant.findById(variantId);
    if (!variant) {
      return next(new Error('Product variant not found'));
    }
    if (variant.status !== 'active') {
      return next(new Error('Cannot list inactive variant'));
    }
    // Ensure variant belongs to the product
    const productId = this.globalProductId || this.productId;
    if (variant.productId.toString() !== productId.toString()) {
      return next(new Error('Variant does not belong to the specified product'));
    }
  }

  // Validate supplier product exists
  if (this.supplierProductId && (this.isNew || this.isModified('supplierProductId'))) {
    const { SupplierProduct } = await import('./SupplierProduct');
    const supplierProduct = await SupplierProduct.findById(this.supplierProductId);
    if (!supplierProduct) {
      return next(new Error('Supplier product not found'));
    }
    
    // Ensure supplier product matches the supplier
    if (supplierProduct.supplierId.toString() !== this.supplierId.toString()) {
      return next(new Error('Supplier product does not belong to the specified supplier'));
    }
    
    // Ensure supplier product matches the global product
    const productId = this.globalProductId || this.productId;
    if (supplierProduct.productId.toString() !== productId.toString()) {
      return next(new Error('Supplier product does not match the global product'));
    }
    
    // Ensure variant matches if provided
    const variantId = this.globalVariantId || this.variantId;
    const supplierVariantId = supplierProduct.variantId || null;
    if ((variantId && supplierVariantId && variantId.toString() !== supplierVariantId.toString()) ||
        (!variantId && supplierVariantId) ||
        (variantId && !supplierVariantId)) {
      return next(new Error('Supplier product variant does not match the global variant'));
    }
    
    // Sync supplier variant ID
    this.supplierVariantId = supplierVariantId;
  }

  next();
});

export const ResellerProduct: Model<IResellerProduct> = mongoose.model<IResellerProduct>(
  'ResellerProduct',
  ResellerProductSchema
);

