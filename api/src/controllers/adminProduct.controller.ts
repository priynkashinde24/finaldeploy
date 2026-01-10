import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200, 'Product name must not exceed 200 characters'),
  slug: z.string().min(1, 'Product slug is required').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
  description: z.string().max(5000, 'Description must not exceed 5000 characters').optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  images: z.array(z.string().url('Invalid image URL')).max(10, 'Maximum 10 images allowed').optional(),
  basePrice: z.number().min(0, 'Base price must be non-negative'),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  basePrice: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * Admin Product Controller
 * 
 * PURPOSE:
 * - Admin-only product management
 * - Create, read, update, delete global products
 * - Products are the foundation for supplier inventory and reseller listings
 * 
 * RULES:
 * - Only admins can create/modify products
 * - Products are global (not supplier/reseller specific)
 * - No stock/pricing logic here (that's in SupplierProduct/ResellerProduct)
 */

/**
 * POST /admin/products
 * Create a new global product (admin only)
 */
export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create products', 403);
      return;
    }

    // Validate request body
    const validatedData = createProductSchema.parse(req.body);

    // Store is already resolved by resolveStore middleware (if route uses it)
    // For admin routes, storeId might come from request body or be optional
    const storeId = req.store?.storeId || (req.body.storeId as string | undefined);
    
    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Check if slug already exists in this store
    const existingProduct = await Product.findOne({ 
      storeId: storeId, // ✅ Check uniqueness per store
      slug: validatedData.slug 
    });
    if (existingProduct) {
      sendError(res, 'Product with this slug already exists in this store', 400);
      return;
    }

    // Create product
    const product = new Product({
      ...validatedData,
      storeId: new mongoose.Types.ObjectId(storeId), // ✅ Set storeId
      images: validatedData.images || [],
      status: validatedData.status || 'active',
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await product.save();

    // Populate createdBy for response
    await product.populate('createdBy', 'name email');

    sendSuccess(res, { product }, 'Product created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/products
 * List all global products (admin only)
 */
export const listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view products', 403);
      return;
    }

    // TODO: Add pagination
    // TODO: Add filters (status, category, search)
    // TODO: Add sorting

    // Filter by store if store is resolved
    const filter: any = {};
    if (req.store) {
      filter.storeId = req.store.storeId; // ✅ Filter by store
    }

    const products = await Product.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { products }, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/products/:id
 * Get a single product by ID (admin only)
 */
export const getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view products', 403);
      return;
    }

    const product = await Product.findById(id)
      .populate('createdBy', 'name email')
      .lean();

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, { product }, 'Product fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/products/:id
 * Update a product (admin only)
 */
export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update products', 403);
      return;
    }

    // Validate request body
    const validatedData = updateProductSchema.parse(req.body);

    // Find product
    const product = await Product.findById(id);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    // Check slug uniqueness if slug is being updated
    if (validatedData.slug && validatedData.slug !== product.slug) {
      const existingProduct = await Product.findOne({ slug: validatedData.slug });
      if (existingProduct) {
        sendError(res, 'Product with this slug already exists', 400);
        return;
      }
    }

    // Update product
    Object.assign(product, validatedData);
    await product.save();

    // Populate createdBy for response
    await product.populate('createdBy', 'name email');

    sendSuccess(res, { product }, 'Product updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * DELETE /admin/products/:id
 * Delete a product (admin only)
 * 
 * WARNING: This should check for existing SupplierProduct and ResellerProduct references
 */
export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can delete products', 403);
      return;
    }

    // TODO: Check for SupplierProduct references
    // TODO: Check for ResellerProduct references
    // TODO: Soft delete vs hard delete decision
    // TODO: Prevent deletion if product is in use

    sendError(res, 'Product deletion not yet implemented', 501);
  } catch (error) {
    next(error);
  }
};

