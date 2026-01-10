import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Attribute Model (Global)
 * 
 * PURPOSE:
 * - Defines reusable attributes that can be applied to products (e.g., Size, Color, Weight, RAM, Storage)
 * - Admin-only creation and management
 * - Attributes are GLOBAL (not product-specific) and reused across products
 * - Attributes are linked to categories (which products can use which attributes)
 * 
 * WHY GLOBAL:
 * - Prevents attribute duplication (e.g., "Size" defined once, used by all clothing products)
 * - Ensures consistency (all products use same "Size" values: S, M, L, XL)
 * - Enables better filtering and search (filter by "Color: Red" across all products)
 * - Category-based visibility (Mobile category has "Screen Size", Clothing has "Size")
 * 
 * DATA FLOW:
 * Category → defines → Attributes (via applicableCategories)
 * Product → belongs to → Category
 * Variant → uses → Attributes (from product's category)
 * 
 * ATTRIBUTE TYPES:
 * - "text": Free-form text input (e.g., "Material: Cotton")
 * - "number": Numeric value (e.g., "Weight: 200g", "RAM: 8GB")
 * - "select": Predefined list of values (e.g., "Size: S, M, L, XL" or "Color: Red, Blue, Green")
 * 
 * RULES:
 * - Attributes are admin-only (createdBy field)
 * - Attributes are linked to categories via applicableCategories
 * - Products in a category can only use attributes applicable to that category
 * - Select-type attributes must have allowedValues
 * - Inactive attributes are hidden from product creation
 */

export interface IAttribute extends Document {
  name: string; // Display name (e.g., "Size", "Color", "Screen Size")
  code: string; // Unique identifier (e.g., "size", "color", "screen_size")
  type: 'text' | 'number' | 'select';
  allowedValues?: string[]; // For select type only (e.g., ["S", "M", "L", "XL"])
  applicableCategories: mongoose.Types.ObjectId[]; // Categories where this attribute can be used
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId; // Admin who created this attribute
  createdAt: Date;
  updatedAt: Date;
}

const AttributeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Attribute name is required'],
      trim: true,
      maxlength: [100, 'Attribute name must not exceed 100 characters'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Attribute code is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'],
      index: true,
      // Unique identifier for the attribute (e.g., "size", "color", "screen_size")
    },
    type: {
      type: String,
      enum: ['text', 'number', 'select'],
      required: [true, 'Attribute type is required'],
      // text: Free-form text input
      // number: Numeric value
      // select: Predefined list of values
    },
    allowedValues: {
      type: [String],
      default: [],
      // Required for "select" type, optional for others
      // Example: ["S", "M", "L", "XL"] for Size attribute
    },
    applicableCategories: {
      type: [Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
      index: true,
      // Categories where this attribute can be used
      // Products in these categories can use this attribute
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
      // Inactive attributes are hidden from product creation
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by (admin) is required'],
      // Only admins can create attributes
    },
  },
  {
    timestamps: true,
  }
);

// Unique index on code (already defined in schema, but explicit for clarity)
AttributeSchema.index({ code: 1 }, { unique: true });

// Compound indexes for common queries
AttributeSchema.index({ applicableCategories: 1, status: 1 }); // Get attributes for a category
AttributeSchema.index({ type: 1, status: 1 }); // Get attributes by type
AttributeSchema.index({ status: 1 }); // Get all active attributes

// Validation: Select type must have allowedValues
AttributeSchema.pre('save', async function (next) {
  if (this.type === 'select') {
    if (!this.allowedValues || this.allowedValues.length === 0) {
      return next(new Error('Select-type attributes must have at least one allowed value'));
    }
  }
  next();
});

// Validation: Ensure applicable categories exist and are active
AttributeSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('applicableCategories')) {
    if (this.applicableCategories.length > 0) {
      const { Category } = await import('./Category');
      const categories = await Category.find({
        _id: { $in: this.applicableCategories },
      });
      
      if (categories.length !== this.applicableCategories.length) {
        return next(new Error('One or more applicable categories not found'));
      }
      
      // Check if all categories are active
      const inactiveCategories = categories.filter((cat) => cat.status !== 'active');
      if (inactiveCategories.length > 0) {
        return next(new Error('Cannot assign attribute to inactive categories'));
      }
    }
  }
  next();
});

export const Attribute: Model<IAttribute> = mongoose.model<IAttribute>('Attribute', AttributeSchema);

