import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Cart Recovery Unsubscribe Model
 *
 * PURPOSE:
 * - Track users who have opted out of cart recovery emails
 * - GDPR-compliant unsubscribe
 * - Per-store opt-out support
 *
 * RULES:
 * - One record per email per store
 * - Opt-out is permanent (until user re-subscribes)
 */

export interface ICartRecoveryUnsubscribe extends Document {
  storeId: mongoose.Types.ObjectId;
  email: string; // Lowercase, normalized
  userId?: mongoose.Types.ObjectId | string; // If user is logged in
  unsubscribedAt: Date;
  reason?: string; // Optional reason for unsubscribe
  createdAt: Date;
  updatedAt: Date;
}

const CartRecoveryUnsubscribeSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    unsubscribedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One opt-out per email per store
CartRecoveryUnsubscribeSchema.index({ storeId: 1, email: 1 }, { unique: true });

export const CartRecoveryUnsubscribe: Model<ICartRecoveryUnsubscribe> =
  mongoose.models.CartRecoveryUnsubscribe ||
  mongoose.model<ICartRecoveryUnsubscribe>('CartRecoveryUnsubscribe', CartRecoveryUnsubscribeSchema);

