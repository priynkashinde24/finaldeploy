import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { resolvePricingRules } from '../utils/pricingEngine';
import { validateMarkupRule, resolveMarkupRule } from '../utils/markupEngine';
import { evaluateAndCreateMarginAlert } from '../utils/marginAlertEngine';
import { canCreateProduct } from '../utils/planGuard';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

// Validation schemas
const selectProductSchema = z.object({
  supplierVariantId: z.string().min(1, 'Supplier variant ID is required'),
  resellerPrice: z.number().min(0, 'Reseller price must be non-negative').optional(),
  margin: z.number().min(0, 'Margin must be non-negative').max(1000, 'Margin must not exceed 1000%').optional(),
});

const createResellerProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  sellingPrice: z.number().min(0, 'Selling price must be non-negative'),
  margin: z.number().min(0, 'Margin must be non-negative').max(1000, 'Margin must not exceed 1000%'),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateResellerProductSchema = z.object({
  sellingPrice: z.number().min(0).optional(),
  margin: z.number().min(0).max(1000).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * Reseller Product Controller
 * 
 * PURPOSE:
 * - Reseller manages their product catalog
 * - Sets margin and selling price
 * - Pricing rules are enforced before saving
 * - Syncs stock, cost, and status from supplier
 */

/**
 * GET /reseller/catalog
 * List available supplier products for reseller to select from
 */
export const getResellerCatalog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view catalog', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Query parameters
    const { category, brand, supplier, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
      status: 'active',
      stockQuantity: { $gt: 0 }, // Only show products with stock
    };

    if (supplier) {
      filter.supplierId = new mongoose.Types.ObjectId(supplier as string);
    }

    // Get supplier products
    const supplierProducts = await SupplierProduct.find(filter)
      .populate('productId', 'name slug description categoryId brandId images basePrice')
      .populate('variantId', 'sku attributes basePrice images')
      .populate('supplierId', 'name email')
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Filter by category/brand if provided (after populate)
    let filteredProducts = supplierProducts;
    if (category) {
      filteredProducts = filteredProducts.filter((sp: any) => 
        sp.productId?.categoryId?.toString() === category
      );
    }
    if (brand) {
      filteredProducts = filteredProducts.filter((sp: any) => 
        sp.productId?.brandId?.toString() === brand
      );
    }

    // Get total count for pagination
    const totalCount = await SupplierProduct.countDocuments(filter);

    // Format response with pricing info
    const catalog = await Promise.all(
      filteredProducts.map(async (sp: any) => {
        const product = sp.productId;
        const variant = sp.variantId;
        const supplier = sp.supplierId;

        // Get markup rules to show min allowed price
        const markupResult = await resolveMarkupRule({
          variantId: variant?._id || null,
          productId: product?._id || null,
          categoryId: product?.categoryId || null,
          brandId: product?.brandId || null,
          supplierCost: sp.costPrice,
          appliesTo: 'reseller',
        });

        return {
          supplierProductId: sp._id,
          supplierVariantId: sp.variantId || null,
          globalProductId: product?._id,
          globalVariantId: variant?._id || null,
          product: {
            name: product?.name,
            slug: product?.slug,
            description: product?.description,
            images: product?.images || [],
            categoryId: product?.categoryId,
            brandId: product?.brandId,
          },
          variant: variant ? {
            sku: variant.sku,
            attributes: variant.attributes,
            images: variant.images || [],
          } : null,
          supplier: {
            id: supplier?._id,
            name: supplier?.name,
            email: supplier?.email,
          },
          supplierCost: sp.costPrice,
          stockQuantity: sp.stockQuantity,
          minOrderQty: sp.minOrderQty,
          minAllowedPrice: markupResult.minSellingPrice,
          maxAllowedPrice: markupResult.maxSellingPrice,
        };
      })
    );

    sendSuccess(res, {
      catalog,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    }, 'Catalog fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /reseller/products/select
 * Select supplier variant and create reseller product
 * - Validates pricing rules
 * - Creates ResellerProduct with initial sync
 */
export const selectResellerProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can select products', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Check plan limits
    const planCheck = await canCreateProduct(currentUser.id, 'reseller');
    if (!planCheck.allowed) {
      sendError(res, planCheck.reason || 'Plan limit reached', 403);
      return;
    }

    // Validate request body
    const validatedData = selectProductSchema.parse(req.body);
    const supplierVariantId = new mongoose.Types.ObjectId(validatedData.supplierVariantId);

    // Get supplier product (supplierVariantId is actually supplierProductId)
    const supplierProduct = await SupplierProduct.findOne({
      _id: supplierVariantId,
      storeId: new mongoose.Types.ObjectId(storeId),
      status: 'active',
    }).populate('productId').populate('variantId');

    if (!supplierProduct) {
      sendError(res, 'Supplier product not found or inactive', 404);
      return;
    }

    // Check if already selected
    const existing = await ResellerProduct.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: new mongoose.Types.ObjectId(currentUser.id),
      supplierProductId: supplierProduct._id,
      supplierVariantId: supplierProduct.variantId || null,
    });

    if (existing) {
      sendError(res, 'You have already selected this product. Use edit to update pricing.', 400);
      return;
    }

    const product = supplierProduct.productId as any;
    const variant = supplierProduct.variantId as any;
    const supplierCost = supplierProduct.costPrice;
    const syncedStock = supplierProduct.stockQuantity;

    // Determine reseller price and margin
    let resellerPrice: number;
    let margin: number;

    if (validatedData.resellerPrice !== undefined) {
      resellerPrice = validatedData.resellerPrice;
      margin = ((resellerPrice - supplierCost) / supplierCost) * 100;
    } else if (validatedData.margin !== undefined) {
      margin = validatedData.margin;
      resellerPrice = supplierCost * (1 + margin / 100);
    } else {
      // Default: use markup rules to suggest price
      const markupResult = await resolveMarkupRule({
        variantId: variant?._id || null,
        productId: product._id,
        categoryId: product.categoryId,
        brandId: product.brandId || null,
        supplierCost,
        appliesTo: 'reseller',
      });
      resellerPrice = markupResult.minSellingPrice;
      margin = ((resellerPrice - supplierCost) / supplierCost) * 100;
    }

    // Validate pricing rules
    const markupValidation = await validateMarkupRule({
      variantId: variant?._id || null,
      productId: product._id,
      categoryId: product.categoryId,
      brandId: product.brandId || null,
      supplierCost,
      appliesTo: 'reseller',
      proposedSellingPrice: resellerPrice,
    });

    if (!markupValidation.valid) {
      res.status(400).json({
        success: false,
        message: markupValidation.reason || 'Markup rule violation',
        data: {
          suggestedMinPrice: markupValidation.markupResult.minSellingPrice,
        },
      });
      return;
    }

    // Enforce pricing rules
    const pricingResolution = await resolvePricingRules({
      productId: product._id,
      variantId: variant?._id || null,
      categoryId: product.categoryId,
      supplierCost,
      resellerMargin: margin,
      proposedSellingPrice: resellerPrice,
      enforceOn: 'reseller',
    });

    if (!pricingResolution.allowed) {
      const errorMessage = pricingResolution.violations.join('. ') || 'Pricing rule violation';
      res.status(400).json({
        success: false,
        message: errorMessage,
        data: {
          suggestedMinPrice: markupValidation.markupResult.minSellingPrice,
        },
      });
      return;
    }

    // Determine active status based on stock
    const isActive = syncedStock > 0;

    // Create reseller product with initial sync
    const resellerProduct = new ResellerProduct({
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: new mongoose.Types.ObjectId(currentUser.id),
      supplierId: supplierProduct.supplierId,
      globalProductId: product._id,
      globalVariantId: variant?._id || null,
      supplierProductId: supplierProduct._id,
      supplierVariantId: supplierProduct.variantId || null,
      supplierCost,
      resellerPrice,
      margin,
      stockSource: 'supplier',
      syncedStock,
      isActive,
      lastSyncedAt: new Date(),
      // Legacy fields
      productId: product._id,
      variantId: variant?._id || null,
      sellingPrice: resellerPrice,
      status: isActive ? 'active' : 'inactive',
    });

    await resellerProduct.save();

    // Audit log
    await logAudit({
      req,
      action: 'RESELLER_PRODUCT_SELECTED',
      entityType: 'ResellerProduct',
      entityId: resellerProduct._id,
      after: {
        resellerId: currentUser.id,
        supplierProductId: supplierProduct._id.toString(),
        supplierVariantId: supplierProduct.variantId?.toString() || null,
        supplierCost,
        resellerPrice,
        margin,
        syncedStock,
        isActive,
      },
      description: `Reseller selected product from supplier catalog`,
      metadata: {
        storeId,
        globalProductId: product._id.toString(),
        globalVariantId: variant?._id?.toString() || null,
      },
    });

    // Trigger margin alert evaluation (non-blocking, async)
    evaluateAndCreateMarginAlert({
      sellingPrice: resellerPrice,
      supplierCost,
      variantId: variant?._id || null,
      productId: product._id,
      categoryId: product.categoryId,
      brandId: product.brandId || null,
      resellerId: currentUser.id,
      appliesTo: 'reseller',
      scope: variant ? 'variant' : 'product',
      scopeId: variant?._id || product._id,
    }).catch((error) => {
      console.error('[MARGIN ALERT] Failed to create alert:', error);
    });

    sendSuccess(res, { product: resellerProduct }, 'Product selected and synced successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * POST /reseller/products
 * Create reseller product (add variant to catalog) - Legacy endpoint
 */
export const createResellerProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can create product listings', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Check plan limits
    const planCheck = await canCreateProduct(currentUser.id, 'reseller');
    if (!planCheck.allowed) {
      sendError(res, planCheck.reason || 'Plan limit reached', 403);
      return;
    }

    // Validate request body
    const validatedData = createResellerProductSchema.parse(req.body);

    const productId = new mongoose.Types.ObjectId(validatedData.productId);
    const supplierId = new mongoose.Types.ObjectId(validatedData.supplierId);
    const variantId = validatedData.variantId ? new mongoose.Types.ObjectId(validatedData.variantId) : null;

    // Get product to find category
    const product = await Product.findOne({
      _id: productId,
      storeId: new mongoose.Types.ObjectId(storeId),
    });
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    // Get supplier product to get cost price
    const supplierProduct = await SupplierProduct.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      supplierId,
      productId,
      variantId: variantId || null,
      status: 'active',
    });

    if (!supplierProduct) {
      sendError(res, 'Supplier product not found or inactive', 404);
      return;
    }

    const supplierCost = supplierProduct.costPrice;
    const proposedSellingPrice = validatedData.sellingPrice;
    const syncedStock = supplierProduct.stockQuantity;

    // STEP 2: Enforce markup rules (define price bounds)
    const markupValidation = await validateMarkupRule({
      variantId: variantId || null,
      productId,
      categoryId: product.categoryId as mongoose.Types.ObjectId,
      supplierCost,
      appliesTo: 'reseller',
      proposedSellingPrice,
    });

    if (!markupValidation.valid) {
      sendError(res, markupValidation.reason || 'Markup rule violation', 400);
      return;
    }

    // STEP 8: Enforce pricing rules (admin pricing validation)
    const pricingResolution = await resolvePricingRules({
      productId,
      variantId: variantId || null,
      categoryId: product.categoryId as mongoose.Types.ObjectId,
      supplierCost,
      resellerMargin: validatedData.margin,
      proposedSellingPrice,
      enforceOn: 'reseller',
    });

    if (!pricingResolution.allowed) {
      const errorMessage = pricingResolution.violations.join('. ') || 'Pricing rule violation';
      const appliedRuleInfo = pricingResolution.appliedRuleId
        ? ` (Applied rule: ${pricingResolution.appliedRuleId.substring(0, 8)}...)`
        : '';
      sendError(res, `${errorMessage}${appliedRuleInfo}`, 400);
      return;
    }

    // Check for duplicate
    const existing = await ResellerProduct.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: currentUser.id,
      productId,
      variantId: variantId || null,
      supplierId,
    });

    if (existing) {
      sendError(res, 'You have already listed this product. Use edit to update pricing.', 400);
      return;
    }

    // Determine active status based on stock
    const isActive = syncedStock > 0;

    // Create reseller product
    const resellerProduct = new ResellerProduct({
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: new mongoose.Types.ObjectId(currentUser.id),
      supplierId,
      globalProductId: productId,
      globalVariantId: variantId || null,
      supplierProductId: supplierProduct._id,
      supplierVariantId: supplierProduct.variantId || null,
      supplierCost,
      resellerPrice: proposedSellingPrice,
      margin: validatedData.margin,
      stockSource: 'supplier',
      syncedStock,
      isActive,
      lastSyncedAt: new Date(),
      // Legacy fields
      productId,
      variantId: variantId || null,
      sellingPrice: proposedSellingPrice,
      status: isActive ? 'active' : 'inactive',
    });

    await resellerProduct.save();

    // Audit log
    await logAudit({
      req,
      action: 'RESELLER_PRODUCT_SELECTED',
      entityType: 'ResellerProduct',
      entityId: resellerProduct._id,
      after: {
        resellerId: currentUser.id,
        supplierProductId: supplierProduct._id.toString(),
        supplierCost,
        resellerPrice: proposedSellingPrice,
        margin: validatedData.margin,
        syncedStock,
        isActive,
      },
      description: `Reseller created product listing`,
    });

    // Trigger margin alert evaluation (non-blocking, async)
    evaluateAndCreateMarginAlert({
      sellingPrice: proposedSellingPrice,
      supplierCost,
      variantId: variantId || null,
      productId,
      categoryId: product.categoryId as mongoose.Types.ObjectId,
      brandId: product.brandId as mongoose.Types.ObjectId | null,
      resellerId: currentUser.id,
      appliesTo: 'reseller',
      scope: variantId ? 'variant' : 'product',
      scopeId: variantId || productId,
    }).catch((error) => {
      console.error('[MARGIN ALERT] Failed to create alert:', error);
    });

    sendSuccess(res, { product: resellerProduct }, 'Product added to catalog successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /reseller/products/:id
 * Update reseller product (margin, price, status)
 */
export const updateResellerProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can update product listings', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updateResellerProductSchema.parse(req.body);

    // Find reseller product (with store filter for multi-tenant safety)
    const resellerProduct = await ResellerProduct.findOne({
      _id: id,
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: new mongoose.Types.ObjectId(currentUser.id),
    });

    if (!resellerProduct) {
      sendError(res, 'Product listing not found or unauthorized', 404);
      return;
    }

    // Get supplier product to get cost price
    const supplierProduct = await SupplierProduct.findOne({
      supplierId: resellerProduct.supplierId,
      productId: resellerProduct.productId,
      variantId: resellerProduct.variantId || null,
      status: 'active',
    });

    if (!supplierProduct) {
      sendError(res, 'Supplier product not found or inactive', 404);
      return;
    }

    const supplierCost = supplierProduct.costPrice;
    const proposedSellingPrice = validatedData.sellingPrice ?? resellerProduct.sellingPrice;
    const proposedMargin = validatedData.margin ?? resellerProduct.margin;

    // Get product to find category
    const product = await Product.findById(resellerProduct.productId);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    // Enforce markup and pricing rules if selling price or margin is being updated
    if (validatedData.sellingPrice !== undefined || validatedData.margin !== undefined) {
      // STEP 2: Enforce markup rules (define price bounds)
      const markupValidation = await validateMarkupRule({
        variantId: resellerProduct.variantId || null,
        productId: resellerProduct.globalProductId || resellerProduct.productId,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        supplierCost,
        appliesTo: 'reseller',
        proposedSellingPrice: proposedSellingPrice || resellerProduct.resellerPrice || resellerProduct.sellingPrice || 0,
      });

      if (!markupValidation.valid) {
        sendError(res, markupValidation.reason || 'Markup rule violation', 400);
        return;
      }

      // STEP 8: Enforce pricing rules (admin pricing validation)
      const pricingResolution = await resolvePricingRules({
        productId: resellerProduct.globalProductId || resellerProduct.productId,
        variantId: resellerProduct.globalVariantId || resellerProduct.variantId || null,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        supplierCost,
        resellerMargin: proposedMargin || resellerProduct.margin,
        proposedSellingPrice: proposedSellingPrice || resellerProduct.resellerPrice || resellerProduct.sellingPrice || 0,
        enforceOn: 'reseller',
      });

      if (!pricingResolution.allowed) {
        const errorMessage = pricingResolution.violations.join('. ') || 'Pricing rule violation';
        const appliedRuleInfo = pricingResolution.appliedRuleId
          ? ` (Applied rule: ${pricingResolution.appliedRuleId.substring(0, 8)}...)`
          : '';
        sendError(res, `${errorMessage}${appliedRuleInfo}`, 400);
        return;
      }
    }

    // Update reseller product
    if (validatedData.sellingPrice !== undefined) {
      resellerProduct.sellingPrice = validatedData.sellingPrice;
    }
    if (validatedData.margin !== undefined) {
      resellerProduct.margin = validatedData.margin;
    }
    if (validatedData.status !== undefined) {
      resellerProduct.status = validatedData.status;
    }

    await resellerProduct.save();

    // Trigger margin alert evaluation if price was updated (non-blocking, async)
    if (validatedData.sellingPrice !== undefined || validatedData.margin !== undefined) {
      const finalSellingPrice = proposedSellingPrice || resellerProduct.resellerPrice || resellerProduct.sellingPrice || 0;
      const finalVariantId = resellerProduct.globalVariantId || resellerProduct.variantId || null;
      const finalProductId = resellerProduct.globalProductId || resellerProduct.productId;
      
      evaluateAndCreateMarginAlert({
        sellingPrice: finalSellingPrice,
        supplierCost,
        variantId: finalVariantId,
        productId: finalProductId,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        brandId: product.brandId as mongoose.Types.ObjectId | null,
        resellerId: currentUser.id,
        appliesTo: 'reseller',
        scope: finalVariantId ? 'variant' : 'product',
        scopeId: finalVariantId || finalProductId,
      }).catch((error) => {
        // Log but don't fail the request
        console.error('[MARGIN ALERT] Failed to create alert:', error);
      });
    }

    sendSuccess(res, { product: resellerProduct }, 'Product updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reseller/products
 * Get reseller's product catalog with sync info
 */
export const getResellerProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view their product catalog', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const products = await ResellerProduct.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: new mongoose.Types.ObjectId(currentUser.id),
    })
      .populate('globalProductId', 'name slug description categoryId brandId images')
      .populate('globalVariantId', 'sku attributes')
      .populate('supplierId', 'name email')
      .populate('supplierProductId', 'stockQuantity costPrice status')
      .sort({ createdAt: -1 })
      .lean();

    // Format response with sync info
    const formattedProducts = products.map((p: any) => ({
      id: p._id,
      globalProductId: p.globalProductId?._id,
      globalVariantId: p.globalVariantId?._id || null,
      supplierProductId: p.supplierProductId?._id,
      supplierVariantId: p.supplierVariantId || null,
      product: {
        name: p.globalProductId?.name,
        slug: p.globalProductId?.slug,
        description: p.globalProductId?.description,
        images: p.globalProductId?.images || [],
        categoryId: p.globalProductId?.categoryId,
        brandId: p.globalProductId?.brandId,
      },
      variant: p.globalVariantId ? {
        sku: p.globalVariantId.sku,
        attributes: p.globalVariantId.attributes,
      } : null,
      supplier: {
        id: p.supplierId?._id,
        name: p.supplierId?.name,
        email: p.supplierId?.email,
      },
      pricing: {
        supplierCost: p.supplierCost,
        resellerPrice: p.resellerPrice,
        margin: p.margin,
      },
      stock: {
        source: p.stockSource,
        syncedStock: p.syncedStock,
        supplierStock: p.supplierProductId?.stockQuantity || 0,
      },
      status: {
        isActive: p.isActive,
        status: p.status,
      },
      sync: {
        lastSyncedAt: p.lastSyncedAt,
      },
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    sendSuccess(res, { products: formattedProducts }, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /reseller/products/available
 * Get available supplier variants grouped by supplier
 * Returns suppliers with their available variants for reseller to select
 */
export const getAvailableSupplierVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view available variants', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Get all active supplier products with stock for this store
    const supplierProducts = await SupplierProduct.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      status: 'active',
      stockQuantity: { $gt: 0 }, // Only show products with stock
    })
      .populate('supplierId', 'name email')
      .populate('productId', 'name')
      .populate('variantId', 'sku attributes')
      .sort({ supplierId: 1, productId: 1 })
      .lean();

    // Group by supplier
    const suppliersMap = new Map<string, {
      _id: string;
      name: string;
      email: string;
      variants: any[];
    }>();

    for (const sp of supplierProducts) {
      const supplier = sp.supplierId as any;
      if (!supplier || !supplier._id) continue;

      const supplierId = supplier._id.toString();
      
      if (!suppliersMap.has(supplierId)) {
        suppliersMap.set(supplierId, {
          _id: supplierId,
          name: supplier.name || 'Unknown Supplier',
          email: supplier.email || '',
          variants: [],
        });
      }

      const supplierData = suppliersMap.get(supplierId)!;
      const productIdValue = typeof sp.productId === 'object' && sp.productId !== null 
        ? (sp.productId as any)._id?.toString() 
        : (sp.productId as any)?.toString() || null;
      
      const variantIdValue = sp.variantId 
        ? (typeof sp.variantId === 'object' && sp.variantId !== null
            ? (sp.variantId as any)._id?.toString()
            : String(sp.variantId))
        : null;

      supplierData.variants.push({
        _id: sp._id.toString(),
        supplierId: supplierId,
        productId: productIdValue,
        variantId: variantIdValue,
        supplierSku: sp.supplierSku,
        costPrice: sp.costPrice,
        stockQuantity: sp.stockQuantity,
        minOrderQty: sp.minOrderQty,
        status: sp.status,
        // Include populated data for frontend
        productId_populated: sp.productId,
        variantId_populated: sp.variantId,
      });
    }

    // Convert map to array
    const suppliers = Array.from(suppliersMap.values());

    sendSuccess(res, { suppliers }, 'Available variants fetched successfully');
  } catch (error) {
    next(error);
  }
};

