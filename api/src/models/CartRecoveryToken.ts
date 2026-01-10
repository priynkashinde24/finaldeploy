import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

/**
 * Cart Recovery Token Model
 *
 * PURPOSE:
 * - Generate secure recovery tokens for abandoned carts
 * - Single-use tokens with expiration
 * - Prevent token reuse and abuse
 *
 * RULES:
 * - One active token per cart
 * - Token expires (default: 7 days)
 * - Single-use (marked used after recovery)
 */

export interface ICartRecoveryToken extends Document {
  cartId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | string; // Nullable for guest carts
  token: string; // Hashed token (stored)
  tokenHash: string; // Hash of token for lookup
  email: string; // Email to send recovery link to
  expiresAt: Date;
  usedAt?: Date;
  emailSentAt?: Date; // When recovery email was sent
  emailNumber?: number; // Which email in sequence (1, 2, 3)
  createdAt: Date;
  updatedAt: Date;
}

const CartRecoveryTokenSchema: Schema = new Schema(
  {
    cartId: {
      type: Schema.Types.ObjectId,
      ref: 'Cart',
      required: [true, 'Cart ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
      index: true,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    emailNumber: {
      type: Number,
      min: 1,
      max: 3,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
CartRecoveryTokenSchema.index({ cartId: 1, usedAt: 1 });
CartRecoveryTokenSchema.index({ tokenHash: 1, usedAt: 1, expiresAt: 1 });

/**
 * Generate a secure recovery token
 */
export function generateRecoveryToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against a hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}

export const CartRecoveryToken: Model<ICartRecoveryToken> =
  mongoose.models.CartRecoveryToken ||
  mongoose.model<ICartRecoveryToken>('CartRecoveryToken', CartRecoveryTokenSchema);

