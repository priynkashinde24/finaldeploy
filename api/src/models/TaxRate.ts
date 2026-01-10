import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Tax Rate Model
 * 
 * PURPOSE:
 * - Store tax rates per country/category
 * - Support GST (CGST/SGST/IGST) and VAT
 * - Category-specific overrides
 * - Country-specific rates
 * 
 * RULES:
 * - One active rate per category per country
 * - Category can be null (default rate)
 * - Rate components depend on taxType
 */

export interface ITaxRateComponents {
  cgst?: number; // Central GST (India intra-state)
  sgst?: number; // State GST (India intra-state)
  igst?: number; // Integrated GST (India inter-state)
  vat?: number; // VAT amount
}

export interface ITaxRate extends Document {
  storeId?: mongoose.Types.ObjectId; // Optional: store-specific override
  countryCode: string; // ISO country code (IN, UK, DE, etc.)
  taxType: 'GST' | 'VAT';
  categoryId?: mongoose.Types.ObjectId | null; // Product category (null = default rate)
  rate: number; // Tax rate percentage (e.g., 18 for 18%)
  components?: ITaxRateComponents; // For GST: cgst/sgst/igst split
  isActive: boolean;
  exemptionReason?: string; // For zero-rated or exempt items
  effectiveFrom: Date; // When this rate becomes effective
  effectiveTo?: Date; // When this rate expires (null = indefinite)
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const TaxRateComponentsSchema: Schema = new Schema(
  {
    cgst: {
      type: Number,
      min: 0,
      max: 100,
    },
    sgst: {
      type: Number,
      min: 0,
      max: 100,
    },
    igst: {
      type: Number,
      min: 0,
      max: 100,
    },
    vat: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const TaxRateSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
      // Optional: store-specific override
    },
    countryCode: {
      type: String,
      required: [true, 'Country code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    taxType: {
      type: String,
      enum: ['GST', 'VAT'],
      required: [true, 'Tax type is required'],
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
      // null = default rate for country
    },
    rate: {
      type: Number,
      required: [true, 'Tax rate is required'],
      min: [0, 'Tax rate must be non-negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    components: {
      type: TaxRateComponentsSchema,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    exemptionReason: {
      type: String,
      trim: true,
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required'],
      default: Date.now,
      index: true,
    },
    effectiveTo: {
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

// Validate GST components
TaxRateSchema.pre('save', function (next) {
  const taxRate = this as ITaxRate;

  if (taxRate.taxType === 'GST' && taxRate.components) {
    // For GST, validate components
    const { cgst, sgst, igst } = taxRate.components;
    
    // Intra-state: CGST + SGST should equal rate
    if (cgst && sgst) {
      const sum = cgst + sgst;
      if (Math.abs(sum - taxRate.rate) > 0.01) {
        return next(new Error(`GST components (CGST: ${cgst}% + SGST: ${sgst}%) must sum to rate (${taxRate.rate}%)`));
      }
    }
    
    // Inter-state: IGST should equal rate
    if (igst && Math.abs(igst - taxRate.rate) > 0.01) {
      return next(new Error(`IGST (${igst}%) must equal rate (${taxRate.rate}%)`));
    }
  }

  next();
});

// Unique constraint: One active rate per category per country per store
TaxRateSchema.index(
  { storeId: 1, countryCode: 1, categoryId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// Compound indexes for queries
TaxRateSchema.index({ countryCode: 1, taxType: 1, isActive: 1 });
TaxRateSchema.index({ countryCode: 1, categoryId: 1, isActive: 1 });
TaxRateSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

export const TaxRate: Model<ITaxRate> =
  mongoose.models.TaxRate || mongoose.model<ITaxRate>('TaxRate', TaxRateSchema);

