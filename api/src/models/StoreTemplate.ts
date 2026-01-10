import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStoreTemplate extends Document {
  name: string;
  version: string;
  description?: string;
  isDefault: boolean;
  config: {
    settings: {
      currency?: string;
      timezone?: string;
      locale?: string;
      taxMode?: string;
    };
    pricing: {
      pricingRuleIds?: string[];
      markupRuleIds?: string[];
    };
    features: {
      enableCoupons?: boolean;
      enableDynamicPricing?: boolean;
      enableAIInsights?: boolean;
    };
    security: {
      ipRestrictionEnabled?: boolean;
      auditLoggingEnabled?: boolean;
    };
    catalog: {
      defaultCategories?: string[];
      defaultAttributes?: string[];
    };
    ui: {
      theme?: string;
      layoutPreset?: string;
    };
    defaultThemeCode?: string;
    branding?: {
        logo?: { light?: string; dark?: string; favicon?: string };
        colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
        fonts?: { primaryFont?: string; secondaryFont?: string; source?: 'google' | 'custom' };
      };
  };
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const StoreTemplateSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    config: {
      settings: {
        currency: { type: String, default: 'USD' },
        timezone: { type: String, default: 'UTC' },
        locale: { type: String, default: 'en-US' },
        taxMode: { type: String, default: 'standard' },
      },
      pricing: {
        pricingRuleIds: [{ type: String }],
        markupRuleIds: [{ type: String }],
      },
      features: {
        enableCoupons: { type: Boolean, default: true },
        enableDynamicPricing: { type: Boolean, default: false },
        enableAIInsights: { type: Boolean, default: false },
      },
      security: {
        ipRestrictionEnabled: { type: Boolean, default: true },
        auditLoggingEnabled: { type: Boolean, default: true },
      },
      catalog: {
        defaultCategories: [{ type: String }],
        defaultAttributes: [{ type: String }],
      },
      ui: {
        theme: { type: String, default: 'default' },
        layoutPreset: { type: String, default: 'standard' },
      },
      defaultThemeCode: { type: String, default: 'classic' },
      branding: {
        logo: {
          light: String,
          dark: String,
          favicon: String,
        },
        colors: {
          primary: String,
          secondary: String,
          accent: String,
          background: String,
          text: String,
        },
        fonts: {
          primaryFont: String,
          secondaryFont: String,
          source: { type: String, enum: ['google', 'custom'], default: 'google' },
        },
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

StoreTemplateSchema.index({ name: 1, version: 1 }, { unique: true });
StoreTemplateSchema.index(
  { isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

export const StoreTemplate: Model<IStoreTemplate> =
  mongoose.models.StoreTemplate || mongoose.model<IStoreTemplate>('StoreTemplate', StoreTemplateSchema);


