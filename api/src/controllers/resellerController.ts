import { Request, Response, NextFunction } from 'express';
import { ResellerCatalog, IResellerCatalog } from '../models/ResellerCatalog';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

const addToCatalogSchema = z.object({
  supplierProductId: z.string().min(1, 'Supplier Product ID is required'),
  resellerPrice: z.number().min(0, 'Reseller price must be greater than or equal to 0'),
});

export const getResellerCatalog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const resellerId = req.query.resellerId as string || 'default-reseller'; // In production, get from auth

    if (!resellerId) {
      sendError(res, 'Reseller ID is required', 400);
      return;
    }

    const catalogItems = await ResellerCatalog.find({ resellerId }).sort({ createdAt: -1 });

    // Populate product details
    const catalogWithProducts = await Promise.all(
      catalogItems.map(async (item) => {
        const product = await Product.findById(item.supplierProductId);
        return {
          _id: item._id,
          resellerId: item.resellerId,
          supplierProductId: item.supplierProductId,
          resellerPrice: item.resellerPrice,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          product: product
            ? {
                _id: product._id,
                name: product.name,
                description: product.description,
                sku: product.sku,
                price: product.price,
                cost: product.cost,
                quantity: product.quantity,
                category: product.category,
                images: product.images,
              }
            : null,
        };
      })
    );

    sendSuccess(res, catalogWithProducts, 'Reseller catalog retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const addToResellerCatalog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const resellerId = req.body.resellerId || 'default-reseller'; // In production, get from auth

    // Validate request body
    const validatedData = addToCatalogSchema.parse(req.body);

    // Check if product exists
    const product = await Product.findById(validatedData.supplierProductId);
    if (!product) {
      sendError(res, 'Supplier product not found', 404);
      return;
    }

    // Check if already added
    const existing = await ResellerCatalog.findOne({
      resellerId,
      supplierProductId: validatedData.supplierProductId,
    });

    if (existing) {
      sendError(res, 'Product already exists in your catalog', 400);
      return;
    }

    // Create catalog entry
    const catalogItem = new ResellerCatalog({
      resellerId,
      supplierProductId: validatedData.supplierProductId,
      resellerPrice: validatedData.resellerPrice,
      status: 'active',
    });

    await catalogItem.save();

    // Populate product details
    const catalogWithProduct = {
      _id: catalogItem._id,
      resellerId: catalogItem.resellerId,
      supplierProductId: catalogItem.supplierProductId,
      resellerPrice: catalogItem.resellerPrice,
      status: catalogItem.status,
      createdAt: catalogItem.createdAt,
      updatedAt: catalogItem.updatedAt,
      product: {
        _id: product._id,
        name: product.name,
        description: product.description,
        sku: product.sku,
        price: product.price,
        cost: product.cost,
        quantity: product.quantity,
        category: product.category,
        images: product.images,
      },
    };

    sendSuccess(res, catalogWithProduct, 'Product added to catalog successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const removeFromResellerCatalog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const resellerId = req.query.resellerId as string || 'default-reseller'; // In production, get from auth

    if (!id) {
      sendError(res, 'Catalog item ID is required', 400);
      return;
    }

    const catalogItem = await ResellerCatalog.findOneAndDelete({
      _id: id,
      resellerId, // Ensure user can only delete their own items
    });

    if (!catalogItem) {
      sendError(res, 'Catalog item not found or unauthorized', 404);
      return;
    }

    // Use the id from params since we already have it, avoiding ModifyResult type issues
    sendSuccess(res, { id }, 'Product removed from catalog successfully');
  } catch (error) {
    next(error);
  }
};

export const updateResellerPrice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const resellerId = req.body.resellerId || 'default-reseller'; // In production, get from auth

    const priceSchema = z.object({
      resellerPrice: z.number().min(0, 'Reseller price must be greater than or equal to 0'),
    });

    const validatedData = priceSchema.parse(req.body);

    const catalogItem = await ResellerCatalog.findOneAndUpdate(
      {
        _id: id,
        resellerId, // Ensure user can only update their own items
      },
      { resellerPrice: validatedData.resellerPrice },
      { new: true, runValidators: true }
    );

    if (!catalogItem) {
      sendError(res, 'Catalog item not found or unauthorized', 404);
      return;
    }

    sendSuccess(res, catalogItem, 'Reseller price updated successfully');
  } catch (error) {
    next(error);
  }
};

