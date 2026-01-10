import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Inventory Reservation Model
 * 
 * PURPOSE:
 * - Reserve stock during checkout to prevent overselling
 * - Hold inventory between cart creation and order confirmation
 * - Auto-release expired reservations
 * - Support multi-reseller marketplace
 * 
 * FLOW:
 * 1. Cart created → Create reservation (expires in X minutes)
 * 2. Checkout → Extend reservation if needed
 * 3. Order confirmed → Confirm reservation (convert to order)
 * 4. Order cancelled/timeout → Release reservation
 * 
 * RULES:
 * - One reservation per cartId + resellerProductId
 * - Reservations expire after configured timeout (default: 15 minutes)
 * - Available stock = syncedStock - reservedQuantity
 * - Reservations are atomic (prevent race conditions)
 */

export interface IReservation extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  cartId: string; // Cart/session identifier (unique per cart)
  resellerProductId: mongoose.Types.ObjectId; // Reseller product being reserved
  quantity: number; // Quantity reserved
  status: 'reserved' | 'confirmed' | 'released' | 'expired'; // Reservation status
  expiresAt: Date; // When reservation expires
  confirmedAt?: Date; // When reservation was confirmed (order created)
  releasedAt?: Date; // When reservation was released
  orderId?: mongoose.Types.ObjectId; // Order ID if confirmed
  customerId?: mongoose.Types.ObjectId; // Customer ID (if logged in)
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    cartId: {
      type: String,
      required: [true, 'Cart ID is required'],
      index: true,
      // Cart/session identifier (can be session ID, user ID, or guest cart ID)
    },
    resellerProductId: {
      type: Schema.Types.ObjectId,
      ref: 'ResellerProduct',
      required: [true, 'Reseller product ID is required'],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    status: {
      type: String,
      enum: ['reserved', 'confirmed', 'released', 'expired'],
      default: 'reserved',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
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

// Unique constraint: One active reservation per cart + reseller product
ReservationSchema.index(
  { storeId: 1, cartId: 1, resellerProductId: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: 'reserved' } // Only enforce uniqueness for active reservations
  }
);

// Compound indexes for common queries
ReservationSchema.index({ storeId: 1, resellerProductId: 1, status: 1 }); // Get reservations for a product
ReservationSchema.index({ storeId: 1, cartId: 1, status: 1 }); // Get reservations for a cart
ReservationSchema.index({ storeId: 1, expiresAt: 1, status: 1 }); // Find expired reservations
ReservationSchema.index({ storeId: 1, orderId: 1 }); // Find reservation by order
ReservationSchema.index({ storeId: 1, customerId: 1, status: 1 }); // Find customer reservations

// TTL index for automatic cleanup (optional, but we'll use job instead for better control)
// ReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Validation: Ensure reseller product exists and is active
ReservationSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('resellerProductId')) {
    const { ResellerProduct } = await import('./ResellerProduct');
    const resellerProduct = await ResellerProduct.findById(this.resellerProductId);
    if (!resellerProduct) {
      return next(new Error('Reseller product not found'));
    }
    if (!resellerProduct.isActive) {
      return next(new Error('Cannot reserve inactive reseller product'));
    }
  }

  // Ensure expiration is in the future
  if (this.expiresAt && this.expiresAt <= new Date()) {
    return next(new Error('Reservation expiration must be in the future'));
  }

  next();
});

export const Reservation: Model<IReservation> = mongoose.model<IReservation>(
  'Reservation',
  ReservationSchema
);

