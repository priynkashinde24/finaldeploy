import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMagicLink extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const MagicLinkSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    used: {
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
MagicLinkSchema.index({ tokenHash: 1, used: 1, expiresAt: 1 });
MagicLinkSchema.index({ email: 1, used: 1 });

export const MagicLink: Model<IMagicLink> =
  mongoose.models.MagicLink || mongoose.model<IMagicLink>('MagicLink', MagicLinkSchema);

