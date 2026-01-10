import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStorePage extends Document {
  storeId: string;
  pageType: 'home' | 'products' | 'product-detail' | 'cart' | 'checkout' | 'contact';
  blocks: Record<string, any>; // JSON blocks for page content
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StorePageSchema: Schema = new Schema(
  {
    storeId: {
      type: String,
      required: [true, 'Store ID is required'],
      trim: true,
      index: true,
    },
    pageType: {
      type: String,
      required: [true, 'Page type is required'],
      enum: ['home', 'products', 'product-detail', 'cart', 'checkout', 'contact'],
      index: true,
    },
    blocks: {
      type: Schema.Types.Mixed,
      default: {},
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Compound index to ensure one active page per type per store
StorePageSchema.index({ storeId: 1, pageType: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export const StorePage: Model<IStorePage> = mongoose.models.StorePage || mongoose.model<IStorePage>('StorePage', StorePageSchema);

