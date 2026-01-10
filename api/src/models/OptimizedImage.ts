import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Optimized Image Model
 * 
 * PURPOSE:
 * - Track optimized images and their variants
 * - Store metadata about optimizations
 * - Support CDN integration
 * - Track usage and performance
 */

type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'original';

export interface IOptimizedImage extends Document {
  storeId?: mongoose.Types.ObjectId | null; // Store (tenant) reference
  originalUrl: string; // Original image URL
  originalPath?: string; // Original file path
  originalSize: number; // Original file size in bytes
  originalFormat: string; // Original format (jpeg, png, etc.)
  originalWidth: number;
  originalHeight: number;
  
  // Optimized variants
  variants: Array<{
    size: string; // 'thumbnail', 'small', 'medium', 'large', 'xlarge', 'original'
    width: number;
    height: number;
    format: ImageFormat;
    url: string; // Optimized image URL
    path: string; // File path
    fileSize: number; // File size in bytes
    quality: number;
    createdAt: Date;
  }>;
  
  // Optimization metadata
  optimizedAt: Date;
  optimizationOptions: {
    format?: ImageFormat;
    quality?: number;
    progressive?: boolean;
    lossless?: boolean;
  };
  
  // Usage tracking
  accessCount: number;
  lastAccessedAt?: Date;
  
  // Status
  status: 'pending' | 'optimized' | 'failed' | 'archived';
  error?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const OptimizedImageSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    originalUrl: {
      type: String,
      required: true,
      index: true,
    },
    originalPath: {
      type: String,
      default: null,
    },
    originalSize: {
      type: Number,
      required: true,
    },
    originalFormat: {
      type: String,
      required: true,
    },
    originalWidth: {
      type: Number,
      required: true,
    },
    originalHeight: {
      type: Number,
      required: true,
    },
    variants: [
      {
        size: {
          type: String,
          required: true,
          enum: ['thumbnail', 'small', 'medium', 'large', 'xlarge', 'original'],
        },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        format: {
          type: String,
          required: true,
          enum: ['jpeg', 'png', 'webp', 'avif', 'original'],
        },
        url: { type: String, required: true },
        path: { type: String, required: true },
        fileSize: { type: Number, required: true },
        quality: { type: Number, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    optimizedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    optimizationOptions: {
      format: {
        type: String,
        enum: ['jpeg', 'png', 'webp', 'avif', 'original'],
      },
      quality: { type: Number },
      progressive: { type: Boolean },
      lossless: { type: Boolean },
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'optimized', 'failed', 'archived'],
      default: 'pending',
      index: true,
    },
    error: {
      type: String,
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

// Indexes
OptimizedImageSchema.index({ storeId: 1, originalUrl: 1 }, { unique: true });
OptimizedImageSchema.index({ status: 1, optimizedAt: -1 });
OptimizedImageSchema.index({ 'variants.size': 1, 'variants.format': 1 });

export const OptimizedImage: Model<IOptimizedImage> = mongoose.model<IOptimizedImage>(
  'OptimizedImage',
  OptimizedImageSchema
);

