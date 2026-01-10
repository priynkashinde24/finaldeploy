import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Tax Profile Model
 * 
 * PURPOSE:
 * - Store tax registration information for entities
 * - GSTIN for India, VAT number for EU/UK
 * - State/country information
 * - Required for invoice generation
 * 
 * RULES:
 * - One profile per entity per store
 * - Snapshot copied to invoice (immutable)
 * - Required for tax calculation
 */

export interface ITaxProfile extends Document {
  storeId: mongoose.Types.ObjectId;
  entityType: 'store' | 'supplier' | 'reseller' | 'platform';
  entityId: string; // Store ID, Supplier ID, Reseller ID, or 'platform'
  countryCode: string; // ISO country code
  stateCode?: string; // State/province code (required for GST)
  gstin?: string; // GST Identification Number (India)
  vatNumber?: string; // VAT Registration Number (EU/UK)
  isRegistered: boolean; // Whether entity is tax registered
  registrationDate?: Date; // When tax registration was obtained
  businessName?: string; // Legal business name
  businessAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const TaxProfileSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    entityType: {
      type: String,
      enum: ['store', 'supplier', 'reseller', 'platform'],
      required: [true, 'Entity type is required'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      trim: true,
      index: true,
    },
    countryCode: {
      type: String,
      required: [true, 'Country code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    stateCode: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
      // Required for GST (India)
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      // Format: 15 characters (2 state + 10 PAN + 3 entity + 1 check)
      validate: {
        validator: function (v: string | undefined) {
          if (!v) return true; // Optional
          return /^[0-9A-Z]{15}$/.test(v);
        },
        message: 'GSTIN must be 15 alphanumeric characters',
      },
    },
    vatNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isRegistered: {
      type: Boolean,
      required: [true, 'Registration status is required'],
      default: false,
      index: true,
    },
    registrationDate: {
      type: Date,
    },
    businessName: {
      type: String,
      trim: true,
    },
    businessAddress: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// Validate GST requirements
TaxProfileSchema.pre('save', function (next) {
  const profile = this as ITaxProfile;

  if (profile.countryCode === 'IN') {
    // India: GSTIN and stateCode required if registered
    if (profile.isRegistered) {
      if (!profile.gstin) {
        return next(new Error('GSTIN is required for registered entities in India'));
      }
      if (!profile.stateCode) {
        return next(new Error('State code is required for GST registration in India'));
      }
    }
  }

  // VAT countries: VAT number required if registered
  if (profile.countryCode !== 'IN' && profile.isRegistered && !profile.vatNumber) {
    // Warning only, not error (some countries may not require VAT number)
    console.warn(`VAT number not provided for registered entity in ${profile.countryCode}`);
  }

  next();
});

// Unique constraint: One profile per entity per store
TaxProfileSchema.index({ storeId: 1, entityType: 1, entityId: 1 }, { unique: true });

// Compound indexes
TaxProfileSchema.index({ storeId: 1, countryCode: 1, isRegistered: 1 });
TaxProfileSchema.index({ storeId: 1, entityType: 1, entityId: 1, isActive: 1 });

export const TaxProfile: Model<ITaxProfile> =
  mongoose.models.TaxProfile || mongoose.model<ITaxProfile>('TaxProfile', TaxProfileSchema);

