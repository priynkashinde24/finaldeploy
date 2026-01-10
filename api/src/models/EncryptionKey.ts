import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Encryption Key Model
 * 
 * PURPOSE:
 * - Track encryption keys for key rotation
 * - Store key metadata (not the actual keys)
 * - Maintain key version history
 * - Support key rotation and migration
 * 
 * SECURITY:
 * - Keys are NOT stored in database (only metadata)
 * - Keys are derived from environment variables
 * - Key versioning for rotation support
 */

export interface IEncryptionKey extends Document {
  keyId: string; // Unique key identifier
  version: number; // Key version number
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  active: boolean; // Whether this key is currently active
  createdAt: Date;
  rotatedAt?: Date; // When this key was rotated out
  metadata?: Record<string, any>; // Additional metadata
}

const EncryptionKeySchema: Schema = new Schema(
  {
    keyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      index: true,
    },
    algorithm: {
      type: String,
      enum: ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'],
      required: true,
      default: 'aes-256-gcm',
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    rotatedAt: {
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

// Compound index for key lookup
EncryptionKeySchema.index({ keyId: 1, version: 1 }, { unique: true });
EncryptionKeySchema.index({ active: 1, createdAt: -1 }); // Find active keys

export const EncryptionKey: Model<IEncryptionKey> = mongoose.model<IEncryptionKey>(
  'EncryptionKey',
  EncryptionKeySchema
);

