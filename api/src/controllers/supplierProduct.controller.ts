import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SupplierProduct } from '../models/SupplierProduct';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

// Validation schemas
const createSupplierProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  supplierSku: z.string().min(1, 'Supplier SKU is required').max(100),
  costPrice: z.number().min(0, 'Cost price must be non-negative'),
  stockQuantity: z.number().min(0, 'Stock quantity must be non-negative'),
  minOrderQty: z.number().min(1, 'Minimum order quantity must be at least 1'),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateSupplierProductSchema = z.object({
  supplierSku: z.string().min(1).max(100).optional(),
  costPrice: z.number().min(0).optional(),
  stockQuantity: z.number().min(0).optional(),
  minOrderQty: z.number().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * GET /supplier/products
 * Get supplier's inventory (mapped products)
 */
export const getSupplierProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Only suppliers can view inventory', 403);
      return;
    }

    const products = await SupplierProduct.find({ supplierId: currentUser.id })
      .populate('productId', 'name slug description category brand images basePrice status')
      .populate('variantId', 'sku attributes basePrice')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { products }, 'Inventory fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /supplier/products/global
 * Get all active global products (for mapping)
 */
export const getGlobalProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Only suppliers can view global products', 403);
      return;
    }

    // Only return active global products
    const products = await Product.find({ status: 'active' })
      .select('name slug description category brand images basePrice status')
      .sort({ name: 1 })
      .lean();

    sendSuccess(res, { products }, 'Global products fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /supplier/products
 * Map a global product and add inventory
 */
export const createSupplierProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Only suppliers can create inventory mappings', 403);
      return;
    }

    // Validate request body
    const validatedData = createSupplierProductSchema.parse(req.body);

    // Check if global product exists and is active
    const globalProduct = await Product.findById(validatedData.productId);
    if (!globalProduct) {
      sendError(res, 'Global product not found', 404);
      return;
    }

    if (globalProduct.status !== 'active') {
      sendError(res, 'Cannot map inventory to inactive product', 400);
      return;
    }

    // Check for duplicate mapping (same supplier + product + variant)
    const existingMapping = await SupplierProduct.findOne({
      supplierId: currentUser.id,
      productId: validatedData.productId,
      variantId: validatedData.variantId || null,
    });

    if (existingMapping) {
      sendError(res, 'You have already mapped this product. Use edit to update inventory.', 400);
      return;
    }

    // Create supplier product mapping
    const supplierProduct = new SupplierProduct({
      supplierId: new mongoose.Types.ObjectId(currentUser.id),
      productId: new mongoose.Types.ObjectId(validatedData.productId),
      variantId: validatedData.variantId ? new mongoose.Types.ObjectId(validatedData.variantId) : null,
      supplierSku: validatedData.supplierSku.toUpperCase(),
      costPrice: validatedData.costPrice,
      stockQuantity: validatedData.stockQuantity,
      minOrderQty: validatedData.minOrderQty,
      status: validatedData.status || 'active',
    });

    await supplierProduct.save();

    // Populate for response
    await supplierProduct.populate('productId', 'name slug description category brand images basePrice status');

    sendSuccess(res, { product: supplierProduct }, 'Product mapped successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /supplier/products/:id
 * Update supplier product inventory
 */
export const updateSupplierProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Only suppliers can update inventory', 403);
      return;
    }

    // Validate request body
    const validatedData = updateSupplierProductSchema.parse(req.body);

    // Find supplier product
    const supplierProduct = await SupplierProduct.findById(id);
    if (!supplierProduct) {
      sendError(res, 'Inventory mapping not found', 404);
      return;
    }

    // Ensure supplier owns this product
    if (supplierProduct.supplierId.toString() !== currentUser.id) {
      sendError(res, 'You can only update your own inventory', 403);
      return;
    }

    // Update fields
    if (validatedData.supplierSku !== undefined) {
      supplierProduct.supplierSku = validatedData.supplierSku.toUpperCase();
    }
    if (validatedData.costPrice !== undefined) {
      supplierProduct.costPrice = validatedData.costPrice;
    }
    if (validatedData.stockQuantity !== undefined) {
      supplierProduct.stockQuantity = validatedData.stockQuantity;
    }
    if (validatedData.minOrderQty !== undefined) {
      supplierProduct.minOrderQty = validatedData.minOrderQty;
    }
    if (validatedData.status !== undefined) {
      supplierProduct.status = validatedData.status;
    }

    await supplierProduct.save();

    // Populate for response
    await supplierProduct.populate('productId', 'name slug description category brand images basePrice status');

    sendSuccess(res, { product: supplierProduct }, 'Inventory updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

