import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Supplier Variant Inventory Model
 * 
 * PURPOSE:
 * - Supplier's inventory for a specific variant
 * - Source of truth for stock and cost
 * - Supplier controls this table ONLY
 * 
 * RULES:
 * - availableStock >= 0
 * - reservedStock <= availableStock
 * - availableStock = totalStock - reservedStock
 * - Supplier never sees reseller prices
 */

export interface ISupplierVariantInventory extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  supplierId: mongoose.Types.ObjectId; // Supplier who owns this inventory
  globalVariantId: mongoose.Types.ObjectId; // Global variant (ProductVariant)
  costPrice: number; // Supplier's cost price for this variant
  availableStock: number; // Available stock (availableStock = totalStock - reservedStock)
  reservedStock: number; // Currently reserved stock (for orders)
  totalStock: number; // Total stock (availableStock + reservedStock)
  lastUpdatedAt: Date; // Last update timestamp
  createdAt: Date;
  updatedAt: Date;
}

const SupplierVariantInventorySchema: Schema = new Schema(
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
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: [true, 'Global variant ID is required'],
      index: true,
    },
    costPrice: {
      type: Number,
      required: [true, 'Cost price is required'],
      min: [0, 'Cost price must be non-negative'],
    },
    availableStock: {
      type: Number,
      required: [true, 'Available stock is required'],
      min: [0, 'Available stock must be non-negative'],
      default: 0,
    },
    reservedStock: {
      type: Number,
      required: [true, 'Reserved stock is required'],
      min: [0, 'Reserved stock must be non-negative'],
      default: 0,
    },
    totalStock: {
      type: Number,
      required: [true, 'Total stock is required'],
      min: [0, 'Total stock must be non-negative'],
      default: 0,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One inventory record per supplier + variant per store
SupplierVariantInventorySchema.index(
  { storeId: 1, supplierId: 1, globalVariantId: 1 },
  { unique: true }
);

// Compound indexes for common queries
SupplierVariantInventorySchema.index({ storeId: 1, supplierId: 1, availableStock: 1 });
SupplierVariantInventorySchema.index({ storeId: 1, globalVariantId: 1, availableStock: 1 });
SupplierVariantInventorySchema.index({ storeId: 1, availableStock: 1 }); // Find in-stock variants

// Validation: Ensure availableStock + reservedStock = totalStock
SupplierVariantInventorySchema.pre('save', async function (next) {
  // Calculate totalStock if not set
  if (this.isNew || this.isModified('availableStock') || this.isModified('reservedStock')) {
    this.totalStock = this.availableStock + this.reservedStock;
  }

  // Validate invariants
  if (this.availableStock < 0) {
    return next(new Error('Available stock cannot be negative'));
  }
  if (this.reservedStock < 0) {
    return next(new Error('Reserved stock cannot be negative'));
  }
  if (this.reservedStock > this.totalStock) {
    return next(new Error('Reserved stock cannot exceed total stock'));
  }
  if (this.availableStock + this.reservedStock !== this.totalStock) {
    return next(new Error('availableStock + reservedStock must equal totalStock'));
  }

  // Update lastUpdatedAt
  this.lastUpdatedAt = new Date();

  next();
});

// Validation: Ensure global variant exists
SupplierVariantInventorySchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('globalVariantId')) {
    const { ProductVariant } = await import('./ProductVariant');
    const variant = await ProductVariant.findById(this.globalVariantId);
    if (!variant) {
      return next(new Error('Global variant not found'));
    }
    if (variant.status !== 'active') {
      return next(new Error('Cannot create inventory for inactive variant'));
    }
  }
  next();
});

export const SupplierVariantInventory: Model<ISupplierVariantInventory> = mongoose.model<ISupplierVariantInventory>(
  'SupplierVariantInventory',
  SupplierVariantInventorySchema
);

