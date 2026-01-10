import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * COD User Flag Model
 * 
 * PURPOSE:
 * - Track COD abuse and failures per user
 * - Block COD for flagged users
 * - Prevent fraud and overbooking
 */

export interface ICODUserFlag extends Document {
  userId: string; // User email or ID
  storeId: mongoose.Types.ObjectId;
  codFailureCount: number; // Number of COD failures
  codCancellationRate: number; // Percentage of cancelled COD orders
  isBlocked: boolean; // Whether COD is blocked for this user
  blockedAt?: Date | null;
  blockedReason?: string;
  lastFailureAt?: Date | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CODUserFlagSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    codFailureCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    codCancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    blockedReason: {
      type: String,
      trim: true,
    },
    lastFailureAt: {
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

// Compound index: One flag per user per store
CODUserFlagSchema.index({ userId: 1, storeId: 1 }, { unique: true });
CODUserFlagSchema.index({ storeId: 1, isBlocked: 1 });

export const CODUserFlag: Model<ICODUserFlag> = mongoose.model<ICODUserFlag>(
  'CODUserFlag',
  CODUserFlagSchema
);

