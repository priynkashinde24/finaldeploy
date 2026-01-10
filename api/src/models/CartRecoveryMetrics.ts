import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Cart Recovery Metrics Model
 *
 * PURPOSE:
 * - Track recovery email performance
 * - Measure conversion rates
 * - Analytics for abandoned cart recovery
 *
 * RULES:
 * - One record per cart recovery attempt
 * - Tracks email opens, clicks, conversions
 */

export interface ICartRecoveryMetrics extends Document {
  storeId: mongoose.Types.ObjectId;
  cartId: mongoose.Types.ObjectId;
  recoveryTokenId: mongoose.Types.ObjectId;
  email: string;
  emailNumber: number; // 1, 2, or 3
  sentAt: Date;
  openedAt?: Date;
  clickedAt?: Date;
  recoveredAt?: Date; // When cart was recovered via link
  convertedAt?: Date; // When order was created from recovered cart
  orderId?: mongoose.Types.ObjectId;
  revenue?: number; // Revenue from converted order
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CartRecoveryMetricsSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    cartId: {
      type: Schema.Types.ObjectId,
      ref: 'Cart',
      required: [true, 'Cart ID is required'],
      index: true,
    },
    recoveryTokenId: {
      type: Schema.Types.ObjectId,
      ref: 'CartRecoveryToken',
      required: [true, 'Recovery token ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    emailNumber: {
      type: Number,
      required: [true, 'Email number is required'],
      min: 1,
      max: 3,
      index: true,
    },
    sentAt: {
      type: Date,
      required: [true, 'Sent at date is required'],
      index: true,
    },
    openedAt: {
      type: Date,
      default: null,
    },
    clickedAt: {
      type: Date,
      default: null,
    },
    recoveredAt: {
      type: Date,
      default: null,
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    revenue: {
      type: Number,
      min: 0,
      default: 0,
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
CartRecoveryMetricsSchema.index({ storeId: 1, sentAt: -1 });
CartRecoveryMetricsSchema.index({ storeId: 1, convertedAt: -1 });
CartRecoveryMetricsSchema.index({ cartId: 1, emailNumber: 1 });

export const CartRecoveryMetrics: Model<ICartRecoveryMetrics> =
  mongoose.models.CartRecoveryMetrics ||
  mongoose.model<ICartRecoveryMetrics>('CartRecoveryMetrics', CartRecoveryMetricsSchema);

