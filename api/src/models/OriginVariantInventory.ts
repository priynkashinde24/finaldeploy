import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Origin Variant Inventory Model
 * 
 * PURPOSE:
 * - Track inventory per origin (warehouse)
 * - Enable origin-level stock management
 * - Support multi-origin fulfillment routing
 * 
 * RULES:
 * - Inventory tracked per origin per variant
 * - availableStock >= 0
 * - reservedStock <= availableStock
 * - availableStock = totalStock - reservedStock
 */

export interface IOriginVariantInventory extends Document {
  supplierId: mongoose.Types.ObjectId;
  originId: mongoose.Types.ObjectId;
  globalVariantId: mongoose.Types.ObjectId;
  availableStock: number; // Available stock at this origin
  reservedStock: number; // Currently reserved stock
  totalStock: number; // Total stock (availableStock + reservedStock)
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OriginVariantInventorySchema: Schema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      index: true,
    },
    originId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierOrigin',
      required: [true, 'Origin ID is required'],
      index: true,
    },
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: [true, 'Global variant ID is required'],
      index: true,
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

// Unique constraint: One inventory record per origin + variant
OriginVariantInventorySchema.index(
  { originId: 1, globalVariantId: 1 },
  { unique: true }
);

// Compound indexes for common queries
OriginVariantInventorySchema.index({ originId: 1, availableStock: 1 });
OriginVariantInventorySchema.index({ globalVariantId: 1, availableStock: 1 });
OriginVariantInventorySchema.index({ supplierId: 1, originId: 1, availableStock: 1 });

// Validation: Ensure availableStock + reservedStock = totalStock
OriginVariantInventorySchema.pre('save', async function (next) {
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

export const OriginVariantInventory: Model<IOriginVariantInventory> =
  mongoose.models.OriginVariantInventory ||
  mongoose.model<IOriginVariantInventory>('OriginVariantInventory', OriginVariantInventorySchema);

