import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import {
  optimizeImage,
  generateResponsiveImages,
  generateThumbnail,
  batchOptimizeImages,
  convertImageFormat,
  compressImage,
  getImageMetadata,
  needsOptimization,
  STANDARD_IMAGE_SIZES,
  ImageOptimizationOptions,
} from '../services/imageOptimization.service';
import { OptimizedImage } from '../models/OptimizedImage';
import { logAudit } from '../utils/auditLogger';
import fs from 'fs';
import path from 'path';

/**
 * Image Optimization Controller
 * 
 * PURPOSE:
 * - Handle image optimization requests
 * - Manage optimized image variants
 * - Provide image metadata
 */

/**
 * POST /api/images/optimize
 * Optimize a single image
 */
export const optimizeSingleImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!req.file) {
      sendError(res, 'No image file provided', 400);
      return;
    }

    const {
      width,
      height,
      fit = 'cover',
      quality = 85,
      format = 'webp',
      progressive,
      lossless,
      strip = true,
    } = req.body;

    const options: ImageOptimizationOptions = {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      fit: fit as any,
      quality: quality ? parseInt(quality) : 85,
      format: format as any,
      progressive: progressive === 'true' || progressive === true,
      lossless: lossless === 'true' || lossless === true,
      strip: strip !== 'false' && strip !== false,
    };

    const result = await optimizeImage(req.file.path, options);

    // Save to database
    const originalMetadata = await getImageMetadata(req.file.path);
    const optimizedImage = new OptimizedImage({
      storeId,
      originalUrl: req.file.path,
      originalPath: req.file.path,
      originalSize: req.file.size,
      originalFormat: originalMetadata.format || 'unknown',
      originalWidth: originalMetadata.width || 0,
      originalHeight: originalMetadata.height || 0,
      variants: [
        {
          size: 'custom',
          width: result.width,
          height: result.height,
          format: result.format,
          url: result.url,
          path: result.optimizedPath,
          fileSize: result.size,
          quality: result.quality,
        },
      ],
      optimizedAt: new Date(),
      optimizationOptions: options,
      status: 'optimized',
    });

    await optimizedImage.save();

    // Clean up original temp file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (error) {
      console.warn('[IMAGE OPTIMIZATION] Failed to cleanup temp file:', error);
    }

    // Audit log
    await logAudit({
      req,
      action: 'IMAGE_OPTIMIZED',
      entityType: 'OptimizedImage',
      entityId: optimizedImage._id.toString(),
      description: `Image optimized: ${req.file.originalname}`,
      metadata: {
        originalSize: req.file.size,
        optimizedSize: result.size,
        format: result.format,
      },
    });

    sendSuccess(res, {
      image: {
        id: optimizedImage._id.toString(),
        originalUrl: optimizedImage.originalUrl,
        optimized: result,
        compressionRatio: ((req.file.size - result.size) / req.file.size * 100).toFixed(2),
      },
    }, 'Image optimized successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/images/generate-responsive
 * Generate responsive image sizes
 */
export const generateResponsive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!req.file) {
      sendError(res, 'No image file provided', 400);
      return;
    }

    const { format = 'webp', quality = 85 } = req.body;

    const results = await generateResponsiveImages(
      req.file.path,
      STANDARD_IMAGE_SIZES,
      format as any,
      parseInt(quality) || 85
    );

    // Get original metadata
    const originalMetadata = await getImageMetadata(req.file.path);

    // Save to database
    const optimizedImage = new OptimizedImage({
      storeId,
      originalUrl: req.file.path,
      originalPath: req.file.path,
      originalSize: req.file.size,
      originalFormat: originalMetadata.format || 'unknown',
      originalWidth: originalMetadata.width || 0,
      originalHeight: originalMetadata.height || 0,
      variants: results.map((result, index) => ({
        size: STANDARD_IMAGE_SIZES[index]?.name || 'custom',
        width: result.width,
        height: result.height,
        format: result.format,
        url: result.url,
        path: result.optimizedPath,
        fileSize: result.size,
        quality: result.quality,
      })),
      optimizedAt: new Date(),
      optimizationOptions: {
        format: format as any,
        quality: parseInt(quality) || 85,
      },
      status: 'optimized',
    });

    await optimizedImage.save();

    // Clean up original temp file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (error) {
      console.warn('[IMAGE OPTIMIZATION] Failed to cleanup temp file:', error);
    }

    // Audit log
    await logAudit({
      req,
      action: 'RESPONSIVE_IMAGES_GENERATED',
      entityType: 'OptimizedImage',
      entityId: optimizedImage._id.toString(),
      description: `Responsive images generated: ${req.file.originalname}`,
      metadata: {
        variantCount: results.length,
        format,
      },
    });

    sendSuccess(res, {
      image: {
        id: optimizedImage._id.toString(),
        originalUrl: optimizedImage.originalUrl,
        variants: results,
        totalSizeBefore: req.file.size,
        totalSizeAfter: results.reduce((sum, r) => sum + r.size, 0),
      },
    }, 'Responsive images generated successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/images/generate-thumbnail
 * Generate thumbnail
 */
export const generateThumb = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No image file provided', 400);
      return;
    }

    const { size = 150, format = 'jpeg', quality = 80 } = req.body;

    const result = await generateThumbnail(
      req.file.path,
      parseInt(size) || 150,
      format as any,
      parseInt(quality) || 80
    );

    // Clean up original temp file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (error) {
      console.warn('[IMAGE OPTIMIZATION] Failed to cleanup temp file:', error);
    }

    sendSuccess(res, {
      thumbnail: result,
    }, 'Thumbnail generated successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/images/:imageId
 * Get optimized image details
 */
export const getOptimizedImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { imageId } = req.params;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    const image = await OptimizedImage.findOne({
      _id: imageId,
      ...(storeId && { storeId }),
    });

    if (!image) {
      sendError(res, 'Optimized image not found', 404);
      return;
    }

    // Update access tracking
    image.accessCount += 1;
    image.lastAccessedAt = new Date();
    await image.save();

    sendSuccess(res, {
      image: {
        id: image._id.toString(),
        originalUrl: image.originalUrl,
        originalSize: image.originalSize,
        originalFormat: image.originalFormat,
        variants: image.variants,
        optimizedAt: image.optimizedAt,
        accessCount: image.accessCount,
        status: image.status,
      },
    }, 'Image details retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/images/:imageId/variant/:size
 * Get specific variant URL
 */
export const getImageVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { imageId, size } = req.params;
    const { format } = req.query;

    const image = await OptimizedImage.findById(imageId);

    if (!image) {
      sendError(res, 'Optimized image not found', 404);
      return;
    }

    // Find variant
    let variant = image.variants.find((v) => v.size === size);

    // If format specified, try to find matching format
    if (format && variant) {
      const formatVariant = image.variants.find(
        (v) => v.size === size && v.format === format
      );
      if (formatVariant) {
        variant = formatVariant;
      }
    }

    if (!variant) {
      sendError(res, `Variant '${size}' not found`, 404);
      return;
    }

    // Update access tracking
    image.accessCount += 1;
    image.lastAccessedAt = new Date();
    await image.save();

    sendSuccess(res, {
      variant: {
        size: variant.size,
        width: variant.width,
        height: variant.height,
        format: variant.format,
        url: variant.url,
        sizeBytes: variant.fileSize,
        quality: variant.quality,
      },
    }, 'Variant retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/images/metadata
 * Get image metadata without optimization
 */
export const getMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No image file provided', 400);
      return;
    }

    const metadata = await getImageMetadata(req.file.path);
    const needsOpt = await needsOptimization(req.file.path);

    // Clean up temp file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (error) {
      console.warn('[IMAGE OPTIMIZATION] Failed to cleanup temp file:', error);
    }

    sendSuccess(res, {
      metadata: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        hasAlpha: metadata.hasAlpha,
        hasProfile: metadata.hasProfile,
        orientation: metadata.orientation,
        size: req.file.size,
        needsOptimization: needsOpt,
      },
    }, 'Metadata retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/images
 * List optimized images
 */
export const listOptimizedImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    const { status, limit = 50, page = 1 } = req.query;

    const filter: any = {};
    if (storeId) {
      filter.storeId = storeId;
    }
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const images = await OptimizedImage.find(filter)
      .sort({ optimizedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    const total = await OptimizedImage.countDocuments(filter);

    sendSuccess(
      res,
      {
        images: images.map((img) => ({
          id: img._id.toString(),
          originalUrl: img.originalUrl,
          originalSize: img.originalSize,
          originalFormat: img.originalFormat,
          variantCount: img.variants.length,
          optimizedAt: img.optimizedAt,
          accessCount: img.accessCount,
          status: img.status,
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Images retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

