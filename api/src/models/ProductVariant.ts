import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Product Variant Model
 * 
 * PURPOSE:
 * - Allows same product to have multiple SKUs (e.g., different sizes, colors)
 * - Each variant is a combination of attribute values from the product's category
 * - Variants are generated from attribute combinations (e.g., Size × Color)
 * - Each variant has its own SKU, price, and images
 * - Referenced by SupplierProduct and ResellerProduct when variant-specific
 * 
 * USE CASE:
 * - Product: "T-Shirt" (Category: Clothing > T-Shirts)
 * - Attributes: Size (S, M, L, XL), Color (Red, Blue, Green)
 * - Variants: "T-Shirt - Small - Red", "T-Shirt - Medium - Blue", etc.
 * 
 * WHY SEPARATE MODEL:
 * - Variants are combinations of attributes (not hardcoded)
 * - Same attribute structure reused across products in same category
 * - Variants can be generated programmatically from attribute combinations
 * - Stock is at variant level (SupplierProduct maps to variantId)
 * 
 * DATA FLOW:
 * Category → defines → Attributes (via applicableCategories)
 * Product → belongs to → Category
 * Variant → combination of → Attributes (from product's category)
 * Supplier → stocks → Variant (via SupplierProduct.variantId)
 * Reseller → prices → Variant (via ResellerProduct.variantId)
 * 
 * OWNERSHIP:
 * - Created by admin (same as Product)
 * - Referenced by suppliers/resellers for variant-specific inventory/pricing
 * 
 * DESIGN DECISIONS:
 * - Attributes reference Attribute model (not hardcoded)
 * - Each variant must have values for all required attributes of the category
 * - Variant SKU is unique globally
 * - Variant images override product images when specified
 * - No stock here (stock is in SupplierProduct)
 */

export interface IProductVariant extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  productId: mongoose.Types.ObjectId;
  sku: string; // Unique SKU per store
  attributes: Array<{
    attributeId: mongoose.Types.ObjectId; // Reference to Attribute model
    value: string | number; // Attribute value (must match Attribute type and allowedValues)
  }>;
  basePrice: number; // Variant-specific base price (overrides product basePrice)
  images?: string[]; // Variant-specific images (overrides product images)
  taxCategoryId?: mongoose.Types.ObjectId; // Optional: Overrides product tax category
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-]+$/, 'SKU must be uppercase alphanumeric with hyphens'],
      index: true,
      // Unique per store (enforced via compound index)
    },
    attributes: {
      type: [
        {
          attributeId: {
            type: Schema.Types.ObjectId,
            ref: 'Attribute',
            required: true,
          },
          value: {
            type: Schema.Types.Mixed,
            required: true,
            // Value must match Attribute type:
            // - text: string
            // - number: number
            // - select: string (must be in Attribute.allowedValues)
          },
        },
      ],
      default: [],
      // Array of attribute-value pairs
      // Example: [
      //   { attributeId: ObjectId("..."), value: "M" },      // Size attribute
      //   { attributeId: ObjectId("..."), value: "Blue" }    // Color attribute
      // ]
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price must be non-negative'],
      // Variant-specific price (overrides product basePrice)
    },
    taxCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'TaxCategory',
      default: null,
      index: true,
      // Optional: If not set, inherits from product
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (images: string[]) => images.length <= 10,
        message: 'Maximum 10 images allowed',
      },
      // Variant-specific images (overrides product images when specified)
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes (storeId is primary filter)
ProductVariantSchema.index({ storeId: 1, sku: 1 }, { unique: true }); // Unique SKU per store
ProductVariantSchema.index({ storeId: 1, productId: 1, status: 1 }); // Get variants for a store and product
ProductVariantSchema.index({ storeId: 1, sku: 1, status: 1 }); // Get variant by store and SKU

// Validation: Ensure variant belongs to active product and attributes are valid
ProductVariantSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('productId')) {
    const { Product } = await import('./Product');
    const product = await Product.findById(this.productId).populate('categoryId');
    if (!product) {
      return next(new Error('Product not found'));
    }
    if (product.status !== 'active') {
      return next(new Error('Cannot create variant for inactive product'));
    }
  }

  // Validate attributes if provided
  if (this.isNew || this.isModified('attributes')) {
    if (this.attributes && this.attributes.length > 0) {
      const { Attribute } = await import('./Attribute');
      const { Product } = await import('./Product');
      const { Category } = await import('./Category');

      // Get product's category
      const product = await Product.findById(this.productId).populate('categoryId');
      if (!product) {
        return next(new Error('Product not found'));
      }

      const category = await Category.findById(product.categoryId);
      if (!category) {
        return next(new Error('Product category not found'));
      }

      // Get all applicable attributes for this category
      const applicableAttributes = await Attribute.find({
        applicableCategories: category._id,
        status: 'active',
      });

      const applicableAttributeIds = applicableAttributes.map((attr) => attr._id.toString());

      // Validate each attribute
      const seenAttributeIds = new Set<string>();
      for (const attrValue of this.attributes) {
        // Check for duplicate attributes
        if (seenAttributeIds.has(attrValue.attributeId.toString())) {
          return next(new Error('Duplicate attribute in variant'));
        }
        seenAttributeIds.add(attrValue.attributeId.toString());

        // Check if attribute is applicable to product's category
        if (!applicableAttributeIds.includes(attrValue.attributeId.toString())) {
          return next(new Error(`Attribute ${attrValue.attributeId} is not applicable to product's category`));
        }

        // Get attribute details
        const attribute = applicableAttributes.find(
          (attr) => attr._id.toString() === attrValue.attributeId.toString()
        );
        if (!attribute) {
          return next(new Error(`Attribute ${attrValue.attributeId} not found`));
        }

        // Validate value type
        if (attribute.type === 'number') {
          if (typeof attrValue.value !== 'number') {
            return next(new Error(`Attribute ${attribute.name} must be a number`));
          }
        } else if (attribute.type === 'text' || attribute.type === 'select') {
          if (typeof attrValue.value !== 'string') {
            return next(new Error(`Attribute ${attribute.name} must be a string`));
          }
        }

        // Validate select type values
        if (attribute.type === 'select') {
          if (!attribute.allowedValues || !attribute.allowedValues.includes(attrValue.value as string)) {
            return next(
              new Error(`Attribute ${attribute.name} value must be one of: ${attribute.allowedValues?.join(', ')}`)
            );
          }
        }
      }
    }
  }

  next();
});

export const ProductVariant: Model<IProductVariant> = mongoose.model<IProductVariant>(
  'ProductVariant',
  ProductVariantSchema
);

