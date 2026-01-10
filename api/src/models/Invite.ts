import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvite extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  role: 'supplier' | 'reseller';
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const InviteSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    role: {
      type: String,
      enum: ['supplier', 'reseller'],
      required: [true, 'Role is required'],
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
InviteSchema.index({ email: 1, used: 1 });
InviteSchema.index({ tokenHash: 1, used: 1, expiresAt: 1 });

// TTL index to auto-delete expired invites (optional - MongoDB will clean up)
// Note: MongoDB TTL runs every 60 seconds, so expired docs may linger briefly

export const Invite: Model<IInvite> =
  mongoose.models.Invite || mongoose.model<IInvite>('Invite', InviteSchema);

