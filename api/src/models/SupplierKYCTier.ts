import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Supplier KYC Tier Model
 * 
 * PURPOSE:
 * - Track supplier KYC tier assignments
 * - Define tier requirements and benefits
 * - Support tier upgrades/downgrades
 * - Enforce tier-based restrictions
 * 
 * TIER SYSTEM:
 * - Tier 1: Basic verification (PAN, Aadhaar)
 * - Tier 2: Business verification (GST, Business documents)
 * - Tier 3: Enhanced verification (Bank statements, Additional documents)
 * 
 * RULES:
 * - One tier assignment per supplier
 * - Tiers can be upgraded or downgraded by admin
 * - Tier requirements must be met before assignment
 */

export type KYCTier = 'tier1' | 'tier2' | 'tier3';
export type TierStatus = 'pending' | 'active' | 'suspended' | 'downgraded';

export interface TierRequirements {
  documents: {
    panCard: boolean;
    aadhaarCard: boolean;
    gstCertificate?: boolean;
    businessLicense?: boolean;
    bankStatement?: boolean;
    addressProof?: boolean;
    incorporationCertificate?: boolean;
  };
  businessInfo: {
    businessName: boolean;
    gstNumber?: boolean;
    businessAddress?: boolean;
    bankAccountDetails?: boolean;
  };
  verification: {
    identityVerified: boolean;
    addressVerified?: boolean;
    businessVerified?: boolean;
    bankAccountVerified?: boolean;
  };
}

export interface TierBenefits {
  maxOrderValue: number; // Maximum order value per transaction
  maxMonthlyOrders: number; // Maximum orders per month
  payoutFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'; // Payout frequency
  payoutDelayDays: number; // Days before payout becomes available
  commissionRate: number; // Platform commission rate (percentage)
  features: string[]; // Additional features enabled
}

export interface ISupplierKYCTier extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  supplierId: mongoose.Types.ObjectId; // Supplier user ID
  currentTier: KYCTier; // Current tier assignment
  status: TierStatus; // Tier status
  assignedAt: Date; // When tier was assigned
  assignedBy: mongoose.Types.ObjectId | null; // Admin who assigned tier
  upgradedAt?: Date | null; // When tier was last upgraded
  downgradedAt?: Date | null; // When tier was last downgraded
  tierHistory: Array<{
    tier: KYCTier;
    status: TierStatus;
    assignedAt: Date;
    assignedBy: mongoose.Types.ObjectId | null;
    reason?: string;
  }>;
  requirements: TierRequirements; // Requirements for current tier
  benefits: TierBenefits; // Benefits for current tier
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

// Tier definitions
export const TIER_DEFINITIONS: Record<KYCTier, { requirements: TierRequirements; benefits: TierBenefits; name: string; description: string }> = {
  tier1: {
    name: 'Tier 1 - Basic',
    description: 'Basic verification with PAN and Aadhaar',
    requirements: {
      documents: {
        panCard: true,
        aadhaarCard: true,
      },
      businessInfo: {
        businessName: true,
      },
      verification: {
        identityVerified: true,
      },
    },
    benefits: {
      maxOrderValue: 50000, // ₹50,000
      maxMonthlyOrders: 50,
      payoutFrequency: 'monthly',
      payoutDelayDays: 15,
      commissionRate: 7, // 7% platform commission
      features: ['basic_support', 'standard_payouts'],
    },
  },
  tier2: {
    name: 'Tier 2 - Business',
    description: 'Business verification with GST and business documents',
    requirements: {
      documents: {
        panCard: true,
        aadhaarCard: true,
        gstCertificate: true,
        businessLicense: true,
        addressProof: true,
      },
      businessInfo: {
        businessName: true,
        gstNumber: true,
        businessAddress: true,
        bankAccountDetails: true,
      },
      verification: {
        identityVerified: true,
        addressVerified: true,
        businessVerified: true,
      },
    },
    benefits: {
      maxOrderValue: 500000, // ₹5,00,000
      maxMonthlyOrders: 200,
      payoutFrequency: 'biweekly',
      payoutDelayDays: 7,
      commissionRate: 5, // 5% platform commission
      features: ['basic_support', 'standard_payouts', 'priority_support', 'analytics'],
    },
  },
  tier3: {
    name: 'Tier 3 - Enhanced',
    description: 'Enhanced verification with bank statements and incorporation documents',
    requirements: {
      documents: {
        panCard: true,
        aadhaarCard: true,
        gstCertificate: true,
        businessLicense: true,
        addressProof: true,
        bankStatement: true,
        incorporationCertificate: true,
      },
      businessInfo: {
        businessName: true,
        gstNumber: true,
        businessAddress: true,
        bankAccountDetails: true,
      },
      verification: {
        identityVerified: true,
        addressVerified: true,
        businessVerified: true,
        bankAccountVerified: true,
      },
    },
    benefits: {
      maxOrderValue: 5000000, // ₹50,00,000
      maxMonthlyOrders: 1000,
      payoutFrequency: 'weekly',
      payoutDelayDays: 3,
      commissionRate: 3, // 3% platform commission
      features: ['basic_support', 'standard_payouts', 'priority_support', 'analytics', 'dedicated_account_manager', 'api_access'],
    },
  },
};

const SupplierKYCTierSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      unique: true, // One tier assignment per supplier
      index: true,
    },
    currentTier: {
      type: String,
      enum: ['tier1', 'tier2', 'tier3'],
      required: [true, 'Current tier is required'],
      default: 'tier1',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'downgraded'],
      default: 'pending',
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    upgradedAt: {
      type: Date,
      default: null,
    },
    downgradedAt: {
      type: Date,
      default: null,
    },
    tierHistory: [
      {
        tier: {
          type: String,
          enum: ['tier1', 'tier2', 'tier3'],
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'active', 'suspended', 'downgraded'],
          required: true,
        },
        assignedAt: {
          type: Date,
          required: true,
        },
        assignedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        reason: {
          type: String,
          trim: true,
        },
      },
    ],
    requirements: {
      documents: {
        panCard: { type: Boolean, default: false },
        aadhaarCard: { type: Boolean, default: false },
        gstCertificate: { type: Boolean, default: false },
        businessLicense: { type: Boolean, default: false },
        bankStatement: { type: Boolean, default: false },
        addressProof: { type: Boolean, default: false },
        incorporationCertificate: { type: Boolean, default: false },
      },
      businessInfo: {
        businessName: { type: Boolean, default: false },
        gstNumber: { type: Boolean, default: false },
        businessAddress: { type: Boolean, default: false },
        bankAccountDetails: { type: Boolean, default: false },
      },
      verification: {
        identityVerified: { type: Boolean, default: false },
        addressVerified: { type: Boolean, default: false },
        businessVerified: { type: Boolean, default: false },
        bankAccountVerified: { type: Boolean, default: false },
      },
    },
    benefits: {
      maxOrderValue: { type: Number, required: true, min: 0 },
      maxMonthlyOrders: { type: Number, required: true, min: 0 },
      payoutFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'biweekly', 'monthly'],
        required: true,
      },
      payoutDelayDays: { type: Number, required: true, min: 0 },
      commissionRate: { type: Number, required: true, min: 0, max: 100 },
      features: [{ type: String }],
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

// Compound indexes
SupplierKYCTierSchema.index({ storeId: 1, supplierId: 1 }, { unique: true });
SupplierKYCTierSchema.index({ storeId: 1, currentTier: 1, status: 1 });
SupplierKYCTierSchema.index({ status: 1, assignedAt: -1 });

export const SupplierKYCTier: Model<ISupplierKYCTier> = mongoose.model<ISupplierKYCTier>(
  'SupplierKYCTier',
  SupplierKYCTierSchema
);

