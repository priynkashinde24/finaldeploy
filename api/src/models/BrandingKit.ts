import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBrandingKit extends Document {
  storeId: mongoose.Types.ObjectId;
  logo?: {
    light?: string;
    dark?: string;
    favicon?: string;
  };
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  fonts?: {
    primaryFont?: string;
    secondaryFont?: string;
    source?: 'google' | 'custom';
  };
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandingKitSchema: Schema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
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
    version: { type: Number, required: true, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

BrandingKitSchema.index({ storeId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
BrandingKitSchema.index({ storeId: 1, version: -1 });

export const BrandingKit: Model<IBrandingKit> =
  mongoose.models.BrandingKit || mongoose.model<IBrandingKit>('BrandingKit', BrandingKitSchema);


