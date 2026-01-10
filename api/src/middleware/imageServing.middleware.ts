import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { OptimizedImage } from '../models/OptimizedImage';
import { optimizeImage, ImageOptimizationOptions } from '../services/imageOptimization.service';

/**
 * Image Serving Middleware
 * 
 * PURPOSE:
 * - Serve optimized images on-demand
 * - Generate variants on-the-fly if not cached
 * - Support format conversion via Accept header
 * - Cache control headers
 */

/**
 * Middleware to serve optimized images
 * Supports on-demand optimization and format conversion
 */
export async function serveOptimizedImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { imageId, size } = req.params;
    const { format, quality, width, height } = req.query;

    // Find optimized image
    const optimizedImage = await OptimizedImage.findById(imageId);

    if (!optimizedImage) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    // Determine requested format (from query or Accept header)
    let requestedFormat: 'jpeg' | 'png' | 'webp' | 'avif' | 'original' = 'webp';
    const acceptHeader = req.headers.accept || '';

    if (format) {
      requestedFormat = format as any;
    } else if (acceptHeader.includes('image/avif')) {
      requestedFormat = 'avif';
    } else if (acceptHeader.includes('image/webp')) {
      requestedFormat = 'webp';
    }

    // Find existing variant
    let variant = optimizedImage.variants.find(
      (v) => v.size === size && v.format === requestedFormat
    );

    // If variant not found, try to find any variant of the requested size
    if (!variant) {
      variant = optimizedImage.variants.find((v) => v.size === size);
    }

    // If still not found and we have the original, generate on-demand
    if (!variant && optimizedImage.originalPath && fs.existsSync(optimizedImage.originalPath)) {
      const options: ImageOptimizationOptions = {
        width: width ? parseInt(width as string) : undefined,
        height: height ? parseInt(height as string) : undefined,
        format: requestedFormat,
        quality: quality ? parseInt(quality as string) : 85,
        strip: true,
      };

      // Get size dimensions from standard sizes
      const standardSizes: Record<string, { width?: number; height?: number }> = {
        thumbnail: { width: 150, height: 150 },
        small: { width: 300, height: 300 },
        medium: { width: 600, height: 600 },
        large: { width: 1200, height: 1200 },
        xlarge: { width: 1920, height: 1920 },
      };

      if (standardSizes[size]) {
        options.width = options.width || standardSizes[size].width;
        options.height = options.height || standardSizes[size].height;
      }

      const result = await optimizeImage(optimizedImage.originalPath, options);

      // Add variant to database
      optimizedImage.variants.push({
        size,
        width: result.width,
        height: result.height,
        format: result.format,
        url: result.url,
        path: result.optimizedPath,
        fileSize: result.size,
        quality: result.quality,
        createdAt: new Date(),
      });

      await optimizedImage.save();

      variant = optimizedImage.variants[optimizedImage.variants.length - 1];
    }

    if (!variant) {
      res.status(404).json({ error: 'Image variant not found' });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(variant.path)) {
      res.status(404).json({ error: 'Image file not found' });
      return;
    }

    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    res.setHeader('Content-Type', `image/${variant.format}`);
    res.setHeader('X-Image-Size', variant.fileSize.toString());
    res.setHeader('X-Image-Width', variant.width.toString());
    res.setHeader('X-Image-Height', variant.height.toString());

    // Update access tracking
    optimizedImage.accessCount += 1;
    optimizedImage.lastAccessedAt = new Date();
    await optimizedImage.save();

    // Send file
    res.sendFile(path.resolve(variant.path));
  } catch (error: any) {
    console.error('[IMAGE SERVING] Error serving image:', error);
    next(error);
  }
}

/**
 * Middleware to serve images with format conversion based on Accept header
 */
export async function serveImageWithFormatConversion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // This middleware can be used to automatically convert images
  // based on browser support (detected via Accept header)
  return serveOptimizedImage(req, res, next);
}

