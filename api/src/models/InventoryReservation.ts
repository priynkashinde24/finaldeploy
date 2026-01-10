import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Inventory Reservation Model (Variant-Level)
 * 
 * PURPOSE:
 * - Reserve variant inventory during checkout
 * - Prevent overselling at variant level
 * - Support checkout rollback
 * - Atomic operations with transactions
 * 
 * FLOW:
 * 1. Checkout → Reserve inventory (transaction)
 * 2. Payment success → Consume inventory
 * 3. Payment failure/timeout → Release inventory
 * 
 * RULES:
 * - One reservation per order + variant
 * - Reservations expire after TTL
 * - No order without reservation
 * - Always transactional
 */

export interface IInventoryReservation extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  orderId: mongoose.Types.ObjectId; // Order ID (required)
  globalVariantId: mongoose.Types.ObjectId; // Global variant being reserved
  supplierId: mongoose.Types.ObjectId; // Supplier providing this variant
  originId?: mongoose.Types.ObjectId; // Origin (warehouse) ID - for multi-origin fulfillment
  quantity: number; // Quantity reserved
  status: 'reserved' | 'released' | 'consumed'; // Reservation status
  expiresAt: Date; // When reservation expires (TTL)
  consumedAt?: Date; // When inventory was consumed (order confirmed)
  releasedAt?: Date; // When reservation was released
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const InventoryReservationSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: [true, 'Global variant ID is required'],
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      index: true,
    },
    originId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierOrigin',
      default: null,
      index: true,
      // Origin (warehouse) ID - for multi-origin fulfillment
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    status: {
      type: String,
      enum: ['reserved', 'released', 'consumed'],
      default: 'reserved',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One reservation per order + variant + origin
InventoryReservationSchema.index(
  { storeId: 1, orderId: 1, globalVariantId: 1, originId: 1 },
  { unique: true }
);

// Compound indexes for common queries
InventoryReservationSchema.index({ storeId: 1, globalVariantId: 1, status: 1 }); // Get reservations for a variant
InventoryReservationSchema.index({ storeId: 1, orderId: 1, status: 1 }); // Get reservations for an order
InventoryReservationSchema.index({ storeId: 1, supplierId: 1, status: 1 }); // Get reservations for a supplier
InventoryReservationSchema.index({ storeId: 1, expiresAt: 1, status: 1 }); // Find expired reservations

// TTL index for automatic cleanup (optional, but we'll use job for better control)
// InventoryReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Validation: Ensure expiration is in the future
InventoryReservationSchema.pre('save', async function (next) {
  if (this.isNew && this.expiresAt && this.expiresAt <= new Date()) {
    return next(new Error('Reservation expiration must be in the future'));
  }
  next();
});

export const InventoryReservation: Model<IInventoryReservation> = mongoose.model<IInventoryReservation>(
  'InventoryReservation',
  InventoryReservationSchema
);

