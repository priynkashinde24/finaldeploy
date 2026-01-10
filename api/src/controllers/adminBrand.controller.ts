import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Brand } from '../models/Brand';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Brand Controller
 * 
 * PURPOSE:
 * - Admin-only brand management
 * - Create, read, update, disable brands
 * - Brands used for brand-level markup policies
 */

// Validation schemas
const createBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(100, 'Brand name must not exceed 100 characters'),
  slug: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * POST /admin/brands
 * Create a new brand
 */
export const createBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create brands', 403);
      return;
    }

    // Validate request body
    const validatedData = createBrandSchema.parse(req.body);

    // Check if brand with same name or slug already exists
    const existingBrand = await Brand.findOne({
      $or: [{ name: validatedData.name }, { slug: validatedData.slug || validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }],
    });

    if (existingBrand) {
      sendError(res, 'Brand with this name or slug already exists', 400);
      return;
    }

    // Create brand
    const brand = new Brand({
      name: validatedData.name,
      slug: validatedData.slug || validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      status: validatedData.status || 'active',
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await brand.save();

    // Populate for response
    await brand.populate('createdBy', 'name email');

    sendSuccess(res, { brand }, 'Brand created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    if ((error as any).code === 11000) {
      sendError(res, 'Brand with this name or slug already exists', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/brands
 * Get all brands
 */
export const getBrands = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view brands', 403);
      return;
    }

    const { status } = req.query;

    const filter: any = {};
    if (status) filter.status = status;

    const brands = await Brand.find(filter)
      .populate('createdBy', 'name email')
      .sort({ name: 1 })
      .lean();

    sendSuccess(res, { brands }, 'Brands retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/brands/:id
 * Update a brand
 */
export const updateBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update brands', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updateBrandSchema.parse(req.body);

    // Find brand
    const brand = await Brand.findById(id);
    if (!brand) {
      sendError(res, 'Brand not found', 404);
      return;
    }

    // Check for duplicate name or slug if updating
    if (validatedData.name || validatedData.slug) {
      const existingBrand = await Brand.findOne({
        $or: [
          { name: validatedData.name || brand.name },
          { slug: validatedData.slug || brand.slug },
        ],
        _id: { $ne: id },
      });

      if (existingBrand) {
        sendError(res, 'Brand with this name or slug already exists', 400);
        return;
      }
    }

    // Update brand
    Object.assign(brand, validatedData);
    await brand.save();

    // Populate for response
    await brand.populate('createdBy', 'name email');

    sendSuccess(res, { brand }, 'Brand updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    if ((error as any).code === 11000) {
      sendError(res, 'Brand with this name or slug already exists', 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/brands/:id/disable
 * Disable a brand
 */
export const disableBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable brands', 403);
      return;
    }

    const { id } = req.params;

    // Find brand
    const brand = await Brand.findById(id);
    if (!brand) {
      sendError(res, 'Brand not found', 404);
      return;
    }

    // Disable brand (inactive brands hide from product creation)
    brand.status = 'inactive';
    await brand.save();

    sendSuccess(res, { brand }, 'Brand disabled successfully');
  } catch (error) {
    next(error);
  }
};

