import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IThemeVariant extends Document {
  storeId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  layout?: {
    headerStyle?: 'centered' | 'left' | 'minimal';
    footerStyle?: 'simple' | 'extended';
    gridDensity?: 'comfortable' | 'compact';
  };
  components?: {
    buttonStyle?: 'rounded' | 'square' | 'pill';
    cardStyle?: 'flat' | 'elevated';
    inputStyle?: 'outline' | 'filled';
  };
  spacing?: {
    baseSpacing?: number;
  };
  animations?: {
    enabled?: boolean;
    intensity?: 'low' | 'medium' | 'high';
  };
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ThemeVariantSchema: Schema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    layout: {
      headerStyle: { type: String, enum: ['centered', 'left', 'minimal'], default: 'left' },
      footerStyle: { type: String, enum: ['simple', 'extended'], default: 'simple' },
      gridDensity: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
    },
    components: {
      buttonStyle: { type: String, enum: ['rounded', 'square', 'pill'], default: 'rounded' },
      cardStyle: { type: String, enum: ['flat', 'elevated'], default: 'flat' },
      inputStyle: { type: String, enum: ['outline', 'filled'], default: 'outline' },
    },
    spacing: {
      baseSpacing: { type: Number, default: 12 },
    },
    animations: {
      enabled: { type: Boolean, default: true },
      intensity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    },
    isActive: { type: Boolean, default: false, index: true },
    version: { type: Number, default: 1, required: true },
  },
  { timestamps: true }
);

ThemeVariantSchema.index({ storeId: 1, code: 1 }, { unique: true });
ThemeVariantSchema.index({ storeId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
ThemeVariantSchema.index({ storeId: 1, version: -1 });

export const ThemeVariant: Model<IThemeVariant> =
  mongoose.models.ThemeVariant || mongoose.model<IThemeVariant>('ThemeVariant', ThemeVariantSchema);


