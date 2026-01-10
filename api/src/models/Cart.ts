import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Cart Model
 *
 * PURPOSE:
 * - Track shopping cart state for abandonment detection
 * - Support guest and authenticated users
 * - Enable cart recovery via email
 * - Track cart lifecycle (active → abandoned → converted)
 *
 * RULES:
 * - Cart becomes "abandoned" only after inactivity threshold
 * - Status transitions: active → abandoned → converted
 * - lastUpdatedAt tracks last activity
 */

export interface ICartItem {
  globalVariantId: mongoose.Types.ObjectId | string;
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productName?: string;
  productImage?: string;
  sku?: string;
}

export interface ICart extends Document {
  storeId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | string; // Nullable for guest carts
  sessionId?: string; // Session ID for guest carts
  email?: string; // Email for guest carts (for recovery)
  items: ICartItem[];
  subtotal: number;
  taxEstimate: number;
  totalEstimate: number;
  couponCode?: string;
  discountAmount?: number;
  status: 'active' | 'converted' | 'abandoned';
  lastUpdatedAt: Date;
  abandonedAt?: Date;
  convertedAt?: Date;
  convertedToOrderId?: mongoose.Types.ObjectId | string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema: Schema = new Schema(
  {
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    productName: {
      type: String,
      trim: true,
    },
    productImage: {
      type: String,
    },
    sku: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const CartSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    items: {
      type: [CartItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxEstimate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalEstimate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'converted', 'abandoned'],
      default: 'active',
      required: true,
      index: true,
    },
    lastUpdatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    abandonedAt: {
      type: Date,
      default: null,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    convertedToOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
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

// Compound indexes
CartSchema.index({ storeId: 1, status: 1, lastUpdatedAt: -1 });
CartSchema.index({ storeId: 1, userId: 1, status: 1 });
CartSchema.index({ storeId: 1, email: 1, status: 1 });
CartSchema.index({ storeId: 1, sessionId: 1, status: 1 });

// Update lastUpdatedAt on save
CartSchema.pre('save', function (next) {
  if (this.isModified('items') || this.isModified('subtotal') || this.isModified('totalEstimate')) {
    this.lastUpdatedAt = new Date();
  }
  next();
});

export const Cart: Model<ICart> =
  mongoose.models.Cart || mongoose.model<ICart>('Cart', CartSchema);

