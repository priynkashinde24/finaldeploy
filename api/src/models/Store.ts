import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStore extends Document {
  _id: string;
  ownerId: string;
  ownerType: 'admin' | 'reseller'; // Store owner type
  name: string;
  code: string; // Unique store code (e.g., WEB, APP, STORE_01)
  slug: string;
  subdomain: string;
  themeId: string;
  status: 'active' | 'suspended'; // Multi-tenant store status
  branding: {
    logo?: string;
    primaryColor?: string;
    font?: string;
  };
  description?: string;
  logoUrl?: string;
  customDomain?: string;
  domainStatus?: 'unverified' | 'pending' | 'verified';
  dnsVerificationToken?: string;
  stripeAccountId?: string | null; // Stripe Connect account ID for reseller
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema: Schema = new Schema(
  {
    ownerId: {
      type: String,
      required: [true, 'Owner ID is required'],
      trim: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['admin', 'reseller'],
      required: [true, 'Owner type is required'],
      default: 'reseller',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      minlength: [2, 'Store name must be at least 2 characters'],
      maxlength: [100, 'Store name must not exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Store code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
      validate: {
        validator: function (v: string) {
          // Allow uppercase letters, numbers, and underscores
          return /^[A-Z0-9_]+$/.test(v);
        },
        message: 'Store code can only contain uppercase letters, numbers, and underscores',
      },
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      validate: {
        validator: function (v: string) {
          // Allow lowercase letters, numbers, and hyphens
          return /^[a-z0-9-]+$/.test(v);
        },
        message: 'Slug can only contain lowercase letters, numbers, and hyphens',
      },
    },
    subdomain: {
      type: String,
      required: [true, 'Subdomain is required'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      validate: {
        validator: function (v: string) {
          // Allow lowercase letters, numbers, and hyphens
          return /^[a-z0-9-]+$/.test(v);
        },
        message: 'Subdomain can only contain lowercase letters, numbers, and hyphens',
      },
    },
    themeId: {
      type: String,
      required: [true, 'Theme ID is required'],
      trim: true,
      default: 'default',
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    branding: {
      logo: {
        type: String,
        trim: true,
        default: '',
      },
      primaryColor: {
        type: String,
        trim: true,
        default: '#AA0000',
      },
      font: {
        type: String,
        trim: true,
        default: 'system-ui',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Store description must not exceed 500 characters'],
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    customDomain: {
      type: String,
      trim: true,
      lowercase: true,
      // IMPORTANT: do NOT default to null. With a unique sparse index, `null` counts as a value
      // and prevents creating multiple stores (all would share customDomain = null).
      default: undefined,
      sparse: true, // Allow multiple nulls
      unique: true, // Unique when set
      validate: {
        validator: function (v: string | null | undefined) {
          if (!v) return true; // Optional field
          // Basic domain validation
          const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
          return domainRegex.test(v);
        },
        message: 'Invalid domain format',
      },
    },
    // Alias for customDomain (for backward compatibility)
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
      sparse: true,
      validate: {
        validator: function (v: string | null | undefined) {
          if (!v) return true;
          const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
          return domainRegex.test(v);
        },
        message: 'Invalid domain format',
      },
    },
    domainStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified'],
      default: 'unverified',
    },
    dnsVerificationToken: {
      type: String,
      default: undefined,
    },
    stripeAccountId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Index for faster queries
StoreSchema.index({ ownerId: 1 });
StoreSchema.index({ ownerType: 1 });
StoreSchema.index({ code: 1 }, { unique: true });
StoreSchema.index({ customDomain: 1 }, { sparse: true, unique: true });

export const Store: Model<IStore> = mongoose.models.Store || mongoose.model<IStore>('Store', StoreSchema);

