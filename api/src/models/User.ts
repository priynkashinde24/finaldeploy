import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  phoneNumber?: string; // WhatsApp phone number (E.164 format)
  whatsappOptIn?: boolean; // WhatsApp opt-in status
  whatsappOptInAt?: Date; // When user opted in
  whatsappOptOutAt?: Date; // When user opted out
  smsOptIn?: boolean; // SMS opt-in status
  smsOptInAt?: Date; // When user opted in to SMS
  smsOptOutAt?: Date; // When user opted out of SMS
  passwordHash: string;
  role: 'admin' | 'supplier' | 'reseller' | 'affiliate';
  isActive: boolean;
  isEmailVerified: boolean;
  isBlocked: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedAt: Date | null;
  approvedBy: mongoose.Types.ObjectId | null;
  rejectionReason: string | null;
  failedLoginAttempts: number;
  lockUntil: Date | null;
  // Multi-tenant store linking
  defaultStoreId?: mongoose.Types.ObjectId | null; // User's default store
  accessibleStores: mongoose.Types.ObjectId[]; // Stores user can access
  // Marketing attribution (immutable after signup)
  marketingAttribution?: {
    firstTouch?: {
      touchId: mongoose.Types.ObjectId;
      channel: string;
      source?: string;
      medium?: string;
      campaign?: string;
      occurredAt: Date;
    };
    lastTouch?: {
      touchId: mongoose.Types.ObjectId;
      channel: string;
      source?: string;
      medium?: string;
      campaign?: string;
      occurredAt: Date;
    };
    signupChannel: string;
    attributedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
      index: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
      index: true,
      // WhatsApp phone number in E.164 format (e.g., +1234567890)
    },
    whatsappOptIn: {
      type: Boolean,
      default: false,
      index: true,
    },
    whatsappOptInAt: {
      type: Date,
      default: null,
    },
    whatsappOptOutAt: {
      type: Date,
      default: null,
    },
    smsOptIn: {
      type: Boolean,
      default: false,
      index: true,
    },
    smsOptInAt: {
      type: Date,
      default: null,
    },
    smsOptOutAt: {
      type: Date,
      default: null,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Don't include passwordHash in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'supplier', 'reseller', 'affiliate'],
      required: [true, 'Role is required'],
      default: 'reseller',
    },
    isActive: {
      type: Boolean,
      default: false, // Default false - requires admin approval (except for admins)
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: function(this: IUser) {
        // Admin users are approved by default, others need approval
        return this.role === 'admin' ? 'approved' : 'pending';
      },
      index: true,
    },
    approvedAt: {
      type: Date,
      default: function(this: IUser) {
        // Admin users are approved immediately
        return this.role === 'admin' ? new Date() : null;
      },
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason must not exceed 500 characters'],
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    // Multi-tenant store linking
    defaultStoreId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    accessibleStores: {
      type: [Schema.Types.ObjectId],
      ref: 'Store',
      default: [],
      index: true,
    },
    // Marketing attribution (immutable after signup)
    marketingAttribution: {
      firstTouch: {
        touchId: { type: Schema.Types.ObjectId, ref: 'MarketingTouch' },
        channel: String,
        source: String,
        medium: String,
        campaign: String,
        occurredAt: Date,
      },
      lastTouch: {
        touchId: { type: Schema.Types.ObjectId, ref: 'MarketingTouch' },
        channel: String,
        source: String,
        medium: String,
        campaign: String,
        occurredAt: Date,
      },
      signupChannel: String,
      attributedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
UserSchema.index({ email: 1 });
UserSchema.index({ isBlocked: 1, isActive: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ approvalStatus: 1, role: 1 });
UserSchema.index({ role: 1, approvalStatus: 1 });

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

