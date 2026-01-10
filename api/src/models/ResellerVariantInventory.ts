import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Reseller Variant Inventory View Model
 * 
 * PURPOSE:
 * - Read-only reflection of supplier variant inventory
 * - Reseller never edits stock (synced from supplier)
 * - Used to determine if variant is sellable
 * 
 * RULES:
 * - Read-only reflection of supplier inventory
 * - Reseller never edits stock
 * - isSellable = syncedStock > 0
 * - Auto-synced from SupplierVariantInventory
 */

export interface IResellerVariantInventory extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  resellerId: mongoose.Types.ObjectId; // Reseller who can sell this variant
  supplierId: mongoose.Types.ObjectId; // Supplier who provides this variant
  globalVariantId: mongoose.Types.ObjectId; // Global variant (ProductVariant)
  syncedStock: number; // Stock synced from SupplierVariantInventory.availableStock
  isSellable: boolean; // Whether variant is sellable (syncedStock > 0)
  lastSyncedAt: Date; // Last sync timestamp
  createdAt: Date;
  updatedAt: Date;
}

const ResellerVariantInventorySchema: Schema = new Schema(
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
    },
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: [true, 'Global variant ID is required'],
      index: true,
    },
    syncedStock: {
      type: Number,
      required: [true, 'Synced stock is required'],
      min: [0, 'Synced stock must be non-negative'],
      default: 0,
    },
    isSellable: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One inventory view per reseller + supplier + variant per store
ResellerVariantInventorySchema.index(
  { storeId: 1, resellerId: 1, supplierId: 1, globalVariantId: 1 },
  { unique: true }
);

// Compound indexes for common queries
ResellerVariantInventorySchema.index({ storeId: 1, resellerId: 1, isSellable: 1 });
ResellerVariantInventorySchema.index({ storeId: 1, globalVariantId: 1, isSellable: 1 });
ResellerVariantInventorySchema.index({ storeId: 1, supplierId: 1, isSellable: 1 });
ResellerVariantInventorySchema.index({ storeId: 1, lastSyncedAt: 1 }); // For sync jobs

// Validation: Auto-set isSellable based on syncedStock
ResellerVariantInventorySchema.pre('save', async function (next) {
  this.isSellable = this.syncedStock > 0;
  next();
});

// Validation: Ensure global variant exists
ResellerVariantInventorySchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('globalVariantId')) {
    const { ProductVariant } = await import('./ProductVariant');
    const variant = await ProductVariant.findById(this.globalVariantId);
    if (!variant) {
      return next(new Error('Global variant not found'));
    }
  }
  next();
});

export const ResellerVariantInventory: Model<IResellerVariantInventory> = mongoose.model<IResellerVariantInventory>(
  'ResellerVariantInventory',
  ResellerVariantInventorySchema
);

