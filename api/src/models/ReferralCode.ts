import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Referral Code Model
 *
 * PURPOSE:
 * - Generate unique referral codes
 * - Track code ownership and usage
 * - Support multiple codes per owner
 * - Enable/disable codes
 *
 * RULES:
 * - Code must be URL-safe
 * - One owner can have multiple codes
 * - Disabled code never tracked
 */

export interface IReferralCode extends Document {
  storeId: mongoose.Types.ObjectId;
  ownerType: 'customer' | 'reseller' | 'influencer';
  ownerId: mongoose.Types.ObjectId | string;
  code: string; // Unique, short, URL-safe code
  status: 'active' | 'disabled';
  usageLimit?: number; // Nullable: unlimited if null
  usageCount: number; // Current usage count
  expiresAt?: Date; // Nullable: never expires if null
  description?: string; // Optional description
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralCodeSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['customer', 'reseller', 'influencer'],
      required: [true, 'Owner type is required'],
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Owner ID is required'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Referral code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [4, 'Code must be at least 4 characters'],
      maxlength: [20, 'Code must not exceed 20 characters'],
      match: [/^[A-Z0-9_-]+$/, 'Code must contain only uppercase letters, numbers, hyphens, and underscores'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      required: true,
      index: true,
    },
    usageLimit: {
      type: Number,
      min: 1,
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
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
ReferralCodeSchema.index({ storeId: 1, code: 1 }, { unique: true });
ReferralCodeSchema.index({ storeId: 1, ownerType: 1, ownerId: 1, status: 1 });
ReferralCodeSchema.index({ code: 1, status: 1 }); // For quick lookup

// Pre-save validation
ReferralCodeSchema.pre('save', function (next) {
  // Auto-disable if usage limit reached
  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    this.status = 'disabled';
  }

  // Auto-disable if expired
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.status = 'disabled';
  }

  next();
});

export const ReferralCode: Model<IReferralCode> =
  mongoose.models.ReferralCode || mongoose.model<IReferralCode>('ReferralCode', ReferralCodeSchema);

