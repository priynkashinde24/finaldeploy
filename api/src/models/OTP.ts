import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOTP extends Document {
  _id: mongoose.Types.ObjectId;
  phone: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

const OTPSchema: Schema = new Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    verified: {
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
OTPSchema.index({ phone: 1, verified: 1, expiresAt: 1 });
OTPSchema.index({ otpHash: 1, verified: 1, expiresAt: 1 });

// TTL index to auto-delete expired OTPs after 1 hour
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const OTP: Model<IOTP> =
  mongoose.models.OTP || mongoose.model<IOTP>('OTP', OTPSchema);

