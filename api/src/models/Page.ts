import mongoose, { Schema, Document, Model } from 'mongoose';

// Block visibility options
export type BlockVisibility = 'always' | 'loggedIn' | 'loggedOut';

// Block type definitions
export type BlockType = 'hero' | 'collection' | 'cta' | 'faq';

// Hero block settings
export interface HeroBlockSettings {
  headline: string;
  subheadline?: string;
  backgroundImage?: string;
  alignment: 'left' | 'center';
  primaryButton?: {
    text: string;
    link: string;
  };
  secondaryButton?: {
    text: string;
    link: string;
  };
}

// Collection block settings
export interface CollectionBlockSettings {
  title: string;
  collectionType: 'category' | 'manual';
  categoryId?: string;
  productIds?: string[];
  layout: 'grid' | 'carousel';
  itemsLimit: number;
}

// CTA block settings
export interface CTABlockSettings {
  text: string;
  buttonText: string;
  buttonLink: string;
  backgroundStyle: 'primary' | 'secondary' | 'gradient';
}

// FAQ block settings
export interface FAQBlockSettings {
  title: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
  layout: 'accordion' | 'list';
}

// Union type for all block settings
export type BlockSettings = HeroBlockSettings | CollectionBlockSettings | CTABlockSettings | FAQBlockSettings;

// Block schema interface
export interface IBlock {
  id: string;
  type: BlockType;
  order: number;
  settings: BlockSettings;
  visibility: BlockVisibility;
}

// Page version history (stored separately for rollback)
export interface IPageVersion {
  _id?: mongoose.Types.ObjectId;
  pageId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  blocks: IBlock[];
  version: number;
  publishedAt?: Date;
  createdAt: Date;
}

// Page interface
export interface IPage extends Document {
  _id: string;
  storeId: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  blocks: IBlock[];
  version: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Block subdocument schema
const BlockSchema = new Schema<IBlock>(
  {
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['hero', 'collection', 'cta', 'faq'],
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    settings: {
      type: Schema.Types.Mixed,
      required: true,
    },
    visibility: {
      type: String,
      enum: ['always', 'loggedIn', 'loggedOut'],
      default: 'always',
    },
  },
  { _id: false }
);

// Page schema
const PageSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          // Allow lowercase letters, numbers, and hyphens
          return /^[a-z0-9-]+$/.test(v);
        },
        message: 'Slug can only contain lowercase letters, numbers, and hyphens',
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Title must not exceed 200 characters'],
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
    blocks: {
      type: [BlockSchema],
      default: [],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    publishedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes
PageSchema.index({ storeId: 1, slug: 1 }, { unique: true });
PageSchema.index({ storeId: 1, status: 1 });
PageSchema.index({ storeId: 1, slug: 1, status: 1 });

// Pre-save hook to generate block IDs if missing
PageSchema.pre('save', function (next) {
  if (this.isModified('blocks')) {
    this.blocks = this.blocks.map((block: any, index: number) => ({
      ...block,
      id: block.id || `block-${Date.now()}-${index}`,
      order: block.order !== undefined ? block.order : index,
    }));
  }
  next();
});

// Pre-save hook to set publishedAt on publish
PageSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Page Version History Schema (for rollback)
const PageVersionSchema: Schema = new Schema(
  {
    pageId: {
      type: Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    blocks: {
      type: [BlockSchema],
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    publishedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

PageVersionSchema.index({ pageId: 1, version: -1 });
PageVersionSchema.index({ storeId: 1, slug: 1, version: -1 });

export const Page: Model<IPage> = mongoose.models.Page || mongoose.model<IPage>('Page', PageSchema);
export const PageVersion: Model<IPageVersion> = mongoose.models.PageVersion || mongoose.model<IPageVersion>('PageVersion', PageVersionSchema);

