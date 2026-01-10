import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  refreshTokenId: string; // UUID used when issuing refresh token
  ipAddress: string;
  userAgent: string;
  deviceLabel: string; // parsed from UA (browser + OS)
  createdAt: Date;
  lastUsedAt: Date;
  revoked: boolean;
}

const SessionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    deviceLabel: {
      type: String,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
SessionSchema.index({ userId: 1, revoked: 1 });
SessionSchema.index({ refreshTokenId: 1, revoked: 1 });

export const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);

