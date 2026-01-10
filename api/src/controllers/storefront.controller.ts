import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { SupplierProduct } from '../models/SupplierProduct';
import { ResellerProduct } from '../models/ResellerProduct';
import { Category } from '../models/Category';
import { Store } from '../models/Store';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { resolveDynamicPrice, getRecentOrderCount } from '../utils/dynamicPricingEngine';
import { applyStoreOverride } from '../utils/storePriceEngine';
import mongoose from 'mongoose';

/**
 * Storefront Controller
 * 
 * PURPOSE:
 * - Customer-facing read-only product listing
 * - Shows only sellable products/variants
 * - No authentication required
 * 
 * SELLABLE LOGIC:
 * A product/variant is sellable ONLY if:
 * 1. Product.status === "active"
 * 2. ProductVariant.status === "active"
 * 3. SupplierProduct.status === "active" AND stockQuantity > 0
 * 4. ResellerProduct.status === "active"
 * 
 * All conditions must be met for a variant to appear in storefront.
 */

/**
 * GET /storefront/stores
 * Get all active stores for browsing (public)
 */
export const listStores = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', search = '' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build query for active stores
    const query: any = {
      status: 'active',
    };

    // Add search filter if provided
    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { subdomain: searchRegex },
      ];
    }

    // Fetch stores with pagination
    const [stores, total] = await Promise.all([
      Store.find(query)
        .select('name description logoUrl subdomain customDomain status createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Store.countDocuments(query),
    ]);

    // Format stores for frontend
    const formattedStores = stores.map((store: any) => ({
      id: store._id.toString(),
      name: store.name,
      description: store.description || '',
      logoUrl: store.logoUrl || null,
      subdomain: store.subdomain,
      customDomain: store.customDomain || null,
      status: store.status,
      createdAt: store.createdAt,
    }));

    sendSuccess(
      res,
      {
        stores: formattedStores,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Stores fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /storefront/products
 * Get all sellable products with variants
 */
export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Store is already resolved by resolveStore middleware
    if (!req.store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    const storeId = req.store.storeId;

    // Find all active products for this store
    const products = await Product.find({ 
      storeId: storeId, // ✅ Filter by store
      status: 'active' 
    })
      .populate('categoryId', 'name slug')
      .populate('subCategoryId', 'name slug')
      .lean();

    const sellableProducts: any[] = [];

    // For each product, check if it has sellable variants
    for (const product of products) {
      // Get all active variants for this product and store
      const variants = await ProductVariant.find({
        storeId: storeId, // ✅ Filter by store
        productId: product._id,
        status: 'active',
      }).lean();

      // For each variant, check if it's sellable
      for (const variant of variants) {
        // Find active supplier products with stock for this variant and store
        const supplierProducts = await SupplierProduct.find({
          storeId: storeId, // ✅ Filter by store
          productId: product._id,
          variantId: variant._id,
          status: 'active',
          stockQuantity: { $gt: 0 },
        }).lean();

        // For each supplier product, check if there's an active reseller product
        for (const supplierProduct of supplierProducts) {
          const resellerProducts = await ResellerProduct.find({
            storeId: storeId, // ✅ Filter by store
            productId: product._id,
            variantId: variant._id,
            supplierId: supplierProduct.supplierId,
            status: 'active',
          }).lean();

          // If reseller product exists, this variant is sellable
          for (const resellerProduct of resellerProducts) {
            // Format variant attributes with attribute details
            const { Attribute } = await import('../models/Attribute');
            const attributes = [];
            if (Array.isArray(variant.attributes)) {
              for (const attr of variant.attributes) {
                const attributeDoc = await Attribute.findById(attr.attributeId).lean();
                attributes.push({
                  attributeId: attr.attributeId?.toString(),
                  attributeName: attributeDoc?.name || 'Unknown',
                  attributeCode: attributeDoc?.code || 'unknown',
                  value: attr.value,
                });
              }
            }

            // STEP 1: Base reseller selling price
            let currentPrice = resellerProduct.sellingPrice;

            // STEP 2: Apply store price override (if store provided)
            if (storeId) {
              const storeOverrideResult = await applyStoreOverride({
                basePrice: currentPrice ?? 0,
                storeId,
                productId: product._id,
                variantId: variant._id,
                categoryId: product.categoryId as mongoose.Types.ObjectId,
                supplierCost: supplierProduct.costPrice,
              });
              if (storeOverrideResult.wasOverridden) {
                currentPrice = storeOverrideResult.overriddenPrice;
              }
            }

            // STEP 3: Apply dynamic pricing
            const recentOrderCount = await getRecentOrderCount(product._id, 24);
            const dynamicPriceResolution = await resolveDynamicPrice({
              baseSellingPrice: currentPrice ?? 0, // Use store-overridden price as base
              productId: product._id,
              variantId: variant._id,
              categoryId: product.categoryId as mongoose.Types.ObjectId,
              currentStock: supplierProduct.stockQuantity,
              recentOrderCount,
            });

            // Use dynamically adjusted price if rule was applied
            const finalSellingPrice = dynamicPriceResolution.adjusted
              ? dynamicPriceResolution.adjustedPrice
              : currentPrice;

            sellableProducts.push({
              productId: product._id.toString(),
              productName: product.name,
              slug: product.slug,
              category: (product.categoryId as any)?.name || null,
              categorySlug: (product.categoryId as any)?.slug || null,
              subCategory: (product.subCategoryId as any)?.name || null,
              brand: product.brand || null,
              images: product.images || [],
              variantId: variant._id.toString(),
              variantSku: variant.sku,
              attributes: attributes,
              sellingPrice: finalSellingPrice, // Dynamically adjusted price
              basePrice: resellerProduct.sellingPrice, // Original base price (for reference)
              resellerId: resellerProduct.resellerId.toString(),
              supplierId: supplierProduct.supplierId.toString(),
              stockAvailable: supplierProduct.stockQuantity,
            });
          }
        }
      }
    }

    sendSuccess(res, { products: sellableProducts }, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /storefront/products/:slug
 * Get product details with all sellable variants
 */
export const getProductBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;

    // Store is already resolved by resolveStore middleware
    if (!req.store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    const storeId = req.store.storeId;

    // Find product by slug and store
    const product = await Product.findOne({ 
      storeId: storeId, // ✅ Filter by store
      slug, 
      status: 'active' 
    })
      .populate('categoryId', 'name slug')
      .populate('subCategoryId', 'name slug')
      .lean();

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    // Get all active variants for this product and store
    const variants = await ProductVariant.find({
      storeId: storeId, // ✅ Filter by store
      productId: product._id,
      status: 'active',
    }).lean();

    const sellableVariants: any[] = [];

    // For each variant, check if it's sellable
    for (const variant of variants) {
      // Find active supplier products with stock for this variant and store
      const supplierProducts = await SupplierProduct.find({
        storeId: storeId, // ✅ Filter by store
        productId: product._id,
        variantId: variant._id,
        status: 'active',
        stockQuantity: { $gt: 0 },
      }).lean();

      // For each supplier product, check if there's an active reseller product
      for (const supplierProduct of supplierProducts) {
        const resellerProducts = await ResellerProduct.find({
          storeId: storeId, // ✅ Filter by store
          productId: product._id,
          variantId: variant._id,
          supplierId: supplierProduct.supplierId,
          status: 'active',
        }).lean();

        // If reseller product exists, this variant is sellable
        for (const resellerProduct of resellerProducts) {
          // Format variant attributes with attribute details
          const { Attribute } = await import('../models/Attribute');
          const attributes = [];
          if (Array.isArray(variant.attributes)) {
            for (const attr of variant.attributes) {
              const attributeDoc = await Attribute.findById(attr.attributeId).lean();
              attributes.push({
                attributeId: attr.attributeId?.toString(),
                attributeName: attributeDoc?.name || 'Unknown',
                attributeCode: attributeDoc?.code || 'unknown',
                value: attr.value,
              });
            }
          }

          // STEP 1: Base reseller selling price
          let currentPrice = resellerProduct.sellingPrice;

          // STEP 2: Apply store price override (if store provided)
          if (storeId) {
            const storeOverrideResult = await applyStoreOverride({
              basePrice: currentPrice ?? 0,
              storeId,
              productId: product._id,
              variantId: variant._id,
              categoryId: product.categoryId as mongoose.Types.ObjectId,
              supplierCost: supplierProduct.costPrice,
            });
            if (storeOverrideResult.wasOverridden) {
              currentPrice = storeOverrideResult.overriddenPrice;
            }
          }

          // STEP 3: Apply dynamic pricing
          const recentOrderCount = await getRecentOrderCount(product._id, 24);
          const dynamicPriceResolution = await resolveDynamicPrice({
            baseSellingPrice: currentPrice ?? 0, // Use store-overridden price as base
            productId: product._id,
            variantId: variant._id,
            categoryId: product.categoryId as mongoose.Types.ObjectId,
            currentStock: supplierProduct.stockQuantity,
            recentOrderCount,
          });

          // Use dynamically adjusted price if rule was applied
          const finalSellingPrice = dynamicPriceResolution.adjusted
            ? dynamicPriceResolution.adjustedPrice
            : currentPrice;

          sellableVariants.push({
            variantId: variant._id.toString(),
            variantSku: variant.sku,
            attributes: attributes,
            sellingPrice: finalSellingPrice,
            basePrice: resellerProduct.sellingPrice, // Original base price (for reference)
            resellerId: resellerProduct.resellerId.toString(),
            supplierId: supplierProduct.supplierId.toString(),
            stockAvailable: supplierProduct.stockQuantity,
          });
        }
      }
    }

    if (sellableVariants.length === 0) {
      sendError(res, 'No sellable variants found for this product', 404);
      return;
    }

    // Group variants by attributes for easier frontend display
    const groupedVariants = sellableVariants.reduce((acc: any, variant: any) => {
      const key = variant.attributes.map((a: any) => `${a.value}`).join('|');
      if (!acc[key]) {
        acc[key] = {
          attributes: variant.attributes,
          variants: [],
        };
      }
      acc[key].variants.push({
        variantId: variant.variantId,
        variantSku: variant.variantSku,
        sellingPrice: variant.sellingPrice,
        resellerId: variant.resellerId,
        supplierId: variant.supplierId,
        stockAvailable: variant.stockAvailable,
      });
      return acc;
    }, {});

    sendSuccess(
      res,
      {
        product: {
          id: product._id.toString(),
          name: product.name,
          slug: product.slug,
          description: product.description,
          category: (product.categoryId as any)?.name || null,
          categorySlug: (product.categoryId as any)?.slug || null,
          subCategory: (product.subCategoryId as any)?.name || null,
          brand: product.brand || null,
          images: product.images || [],
        },
        variants: Object.values(groupedVariants),
      },
      'Product fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};
