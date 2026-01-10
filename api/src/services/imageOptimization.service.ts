import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Image Optimization Service
 * 
 * PURPOSE:
 * - Resize images to multiple sizes
 * - Compress images for web
 * - Convert to modern formats (WebP, AVIF)
 * - Generate thumbnails
 * - Optimize for performance
 * - Support batch processing
 * 
 * FEATURES:
 * - Multiple output formats (JPEG, PNG, WebP, AVIF)
 * - Responsive image sizes
 * - Quality optimization
 * - Metadata preservation
 * - Progressive JPEG support
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'original';
export type ImageFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  fit?: ImageFit;
  quality?: number; // 1-100
  format?: ImageFormat;
  progressive?: boolean; // For JPEG
  lossless?: boolean; // For WebP/AVIF
  strip?: boolean; // Remove metadata
  blur?: number; // 0-1000, for blur effect
  sharpen?: boolean;
  grayscale?: boolean;
  rotate?: number; // 0, 90, 180, 270
  flip?: boolean;
  flop?: boolean;
}

export interface ImageSize {
  width: number;
  height: number;
  name: string; // e.g., 'thumbnail', 'small', 'medium', 'large', 'original'
}

export interface OptimizedImageResult {
  originalPath: string;
  optimizedPath: string;
  format: ImageFormat;
  width: number;
  height: number;
  size: number; // File size in bytes
  quality: number;
  url: string; // Public URL
  metadata?: {
    format: string;
    width: number;
    height: number;
    channels: number;
    hasAlpha: boolean;
    hasProfile: boolean;
    orientation?: number;
  };
}

export interface BatchOptimizationResult {
  success: boolean;
  results: OptimizedImageResult[];
  errors: Array<{ file: string; error: string }>;
  totalProcessed: number;
  totalSizeBefore: number;
  totalSizeAfter: number;
  compressionRatio: number;
}

// Standard image sizes for responsive images
export const STANDARD_IMAGE_SIZES: ImageSize[] = [
  { width: 150, height: 150, name: 'thumbnail' },
  { width: 300, height: 300, name: 'small' },
  { width: 600, height: 600, name: 'medium' },
  { width: 1200, height: 1200, name: 'large' },
  { width: 1920, height: 1920, name: 'xlarge' },
];

// Format-specific quality defaults
const DEFAULT_QUALITY: Record<ImageFormat, number> = {
  jpeg: 85,
  png: 90,
  webp: 85,
  avif: 80,
  original: 100,
};

/**
 * Get storage directory for optimized images
 */
function getOptimizedImageDir(): string {
  const dir = path.join(process.cwd(), 'uploads', 'optimized');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Generate unique filename for optimized image
 */
function generateOptimizedFilename(
  originalFilename: string,
  options: ImageOptimizationOptions
): string {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const hash = crypto.createHash('md5').update(JSON.stringify(options)).digest('hex').substring(0, 8);
  
  const format = options.format || 'jpeg';
  const width = options.width ? `w${options.width}` : '';
  const height = options.height ? `h${options.height}` : '';
  const quality = options.quality ? `q${options.quality}` : '';
  
  const parts = [basename, width, height, quality, hash].filter(Boolean);
  const newExt = format === 'original' ? ext : `.${format}`;
  
  return `${parts.join('_')}${newExt}`;
}

/**
 * Optimize a single image
 */
export async function optimizeImage(
  inputPath: string | Buffer,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult> {
  try {
    // Validate input
    if (!inputPath) {
      throw new Error('Input path or buffer is required');
    }

    // Read image if path provided
    let imageBuffer: Buffer;
    if (typeof inputPath === 'string') {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Image file not found: ${inputPath}`);
      }
      imageBuffer = fs.readFileSync(inputPath);
    } else {
      imageBuffer = inputPath;
    }

    // Get original metadata
    const originalMetadata = await sharp(imageBuffer).metadata();
    const originalSize = imageBuffer.length;

    // Determine output format
    const format = options.format || (originalMetadata.format as ImageFormat) || 'jpeg';
    const quality = options.quality || DEFAULT_QUALITY[format] || 85;

    // Create Sharp instance
    let pipeline = sharp(imageBuffer);

    // Apply transformations
    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: options.fit || 'cover',
        withoutEnlargement: true, // Don't enlarge smaller images
      });
    }

    if (options.rotate) {
      pipeline = pipeline.rotate(options.rotate);
    }

    if (options.flip) {
      pipeline = pipeline.flip();
    }

    if (options.flop) {
      pipeline = pipeline.flop();
    }

    if (options.grayscale) {
      pipeline = pipeline.grayscale();
    }

    if (options.blur && options.blur > 0) {
      pipeline = pipeline.blur(options.blur);
    }

    if (options.sharpen) {
      pipeline = pipeline.sharpen();
    }

    // Apply format-specific options
    const formatOptions: any = {};

    if (format === 'jpeg') {
      formatOptions.quality = quality;
      formatOptions.progressive = options.progressive !== false; // Default true
      formatOptions.mozjpeg = true; // Better compression
    } else if (format === 'png') {
      formatOptions.quality = quality;
      formatOptions.compressionLevel = 9; // Max compression
      formatOptions.palette = true; // Use palette if possible
    } else if (format === 'webp') {
      formatOptions.quality = quality;
      formatOptions.lossless = options.lossless || false;
      formatOptions.effort = 6; // 0-6, higher = better compression but slower
    } else if (format === 'avif') {
      formatOptions.quality = quality;
      formatOptions.lossless = options.lossless || false;
      formatOptions.effort = 4; // 0-9, higher = better compression but slower
    }

    // Strip metadata if requested
    if (options.strip !== false) {
      pipeline = pipeline.removeAlpha().removeAlpha(); // Remove alpha and metadata
    }

    // Process image
    const optimizedBuffer = await pipeline
      .toFormat(format as any, formatOptions)
      .toBuffer();

    // Get optimized metadata
    const optimizedMetadata = await sharp(optimizedBuffer).metadata();

    // Generate filename
    const originalFilename = typeof inputPath === 'string' 
      ? path.basename(inputPath) 
      : `image_${uuidv4()}`;
    
    const optimizedFilename = generateOptimizedFilename(originalFilename, {
      ...options,
      format,
      quality,
    });

    // Save optimized image
    const optimizedDir = getOptimizedImageDir();
    const optimizedPath = path.join(optimizedDir, optimizedFilename);
    fs.writeFileSync(optimizedPath, optimizedBuffer);

    // Generate public URL (adjust based on your CDN/storage setup)
    const url = `/uploads/optimized/${optimizedFilename}`;

    return {
      originalPath: typeof inputPath === 'string' ? inputPath : 'buffer',
      optimizedPath,
      format,
      width: optimizedMetadata.width || 0,
      height: optimizedMetadata.height || 0,
      size: optimizedBuffer.length,
      quality,
      url,
      metadata: {
        format: optimizedMetadata.format || '',
        width: optimizedMetadata.width || 0,
        height: optimizedMetadata.height || 0,
        channels: optimizedMetadata.channels || 0,
        hasAlpha: optimizedMetadata.hasAlpha || false,
        hasProfile: optimizedMetadata.hasProfile || false,
        orientation: optimizedMetadata.orientation,
      },
    };
  } catch (error: any) {
    console.error('[IMAGE OPTIMIZATION] Error optimizing image:', error);
    throw new Error(`Failed to optimize image: ${error.message}`);
  }
}

/**
 * Generate multiple sizes of an image (responsive images)
 */
export async function generateResponsiveImages(
  inputPath: string | Buffer,
  sizes: ImageSize[] = STANDARD_IMAGE_SIZES,
  format: ImageFormat = 'webp',
  quality: number = 85
): Promise<OptimizedImageResult[]> {
  const results: OptimizedImageResult[] = [];

  for (const size of sizes) {
    try {
      const result = await optimizeImage(inputPath, {
        width: size.width,
        height: size.height,
        fit: 'cover',
        format,
        quality,
        strip: true,
      });
      results.push(result);
    } catch (error: any) {
      console.error(`[IMAGE OPTIMIZATION] Failed to generate ${size.name} size:`, error);
    }
  }

  return results;
}

/**
 * Generate thumbnail
 */
export async function generateThumbnail(
  inputPath: string | Buffer,
  size: number = 150,
  format: ImageFormat = 'jpeg',
  quality: number = 80
): Promise<OptimizedImageResult> {
  return optimizeImage(inputPath, {
    width: size,
    height: size,
    fit: 'cover',
    format,
    quality,
    strip: true,
  });
}

/**
 * Batch optimize multiple images
 */
export async function batchOptimizeImages(
  inputPaths: string[],
  options: ImageOptimizationOptions = {}
): Promise<BatchOptimizationResult> {
  const results: OptimizedImageResult[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  let totalSizeBefore = 0;
  let totalSizeAfter = 0;

  for (const inputPath of inputPaths) {
    try {
      // Get original size
      if (fs.existsSync(inputPath)) {
        const stats = fs.statSync(inputPath);
        totalSizeBefore += stats.size;
      }

      const result = await optimizeImage(inputPath, options);
      results.push(result);
      totalSizeAfter += result.size;
    } catch (error: any) {
      errors.push({
        file: inputPath,
        error: error.message,
      });
    }
  }

  const compressionRatio = totalSizeBefore > 0 
    ? ((totalSizeBefore - totalSizeAfter) / totalSizeBefore) * 100 
    : 0;

  return {
    success: errors.length === 0,
    results,
    errors,
    totalProcessed: results.length,
    totalSizeBefore,
    totalSizeAfter,
    compressionRatio,
  };
}

/**
 * Convert image format
 */
export async function convertImageFormat(
  inputPath: string | Buffer,
  targetFormat: ImageFormat,
  quality?: number
): Promise<OptimizedImageResult> {
  return optimizeImage(inputPath, {
    format: targetFormat,
    quality: quality || DEFAULT_QUALITY[targetFormat],
    strip: true,
  });
}

/**
 * Compress image (reduce file size while maintaining quality)
 */
export async function compressImage(
  inputPath: string | Buffer,
  quality: number = 85
): Promise<OptimizedImageResult> {
  // Detect original format
  const imageBuffer = typeof inputPath === 'string' 
    ? fs.readFileSync(inputPath) 
    : inputPath;
  const metadata = await sharp(imageBuffer).metadata();
  const format = (metadata.format as ImageFormat) || 'jpeg';

  return optimizeImage(inputPath, {
    format,
    quality,
    strip: true,
    progressive: format === 'jpeg',
  });
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(
  inputPath: string | Buffer
): Promise<sharp.Metadata> {
  const imageBuffer = typeof inputPath === 'string' 
    ? fs.readFileSync(inputPath) 
    : inputPath;
  
  return sharp(imageBuffer).metadata();
}

/**
 * Check if image needs optimization
 */
export async function needsOptimization(
  inputPath: string,
  maxSize: number = 500 * 1024, // 500KB
  maxWidth: number = 1920,
  maxHeight: number = 1920
): Promise<boolean> {
  try {
    const stats = fs.statSync(inputPath);
    if (stats.size > maxSize) {
      return true;
    }

    const metadata = await getImageMetadata(inputPath);
    if (metadata.width && metadata.width > maxWidth) {
      return true;
    }
    if (metadata.height && metadata.height > maxHeight) {
      return true;
    }

    return false;
  } catch {
    return true; // Assume needs optimization on error
  }
}

/**
 * Clean up old optimized images (older than specified days)
 */
export async function cleanupOldOptimizedImages(daysOld: number = 30): Promise<number> {
  const optimizedDir = getOptimizedImageDir();
  const files = fs.readdirSync(optimizedDir);
  const now = Date.now();
  const maxAge = daysOld * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const file of files) {
    const filePath = path.join(optimizedDir, file);
    const stats = fs.statSync(filePath);
    const age = now - stats.mtime.getTime();

    if (age > maxAge) {
      try {
        fs.unlinkSync(filePath);
        deleted++;
      } catch (error) {
        console.error(`[IMAGE OPTIMIZATION] Failed to delete ${file}:`, error);
      }
    }
  }

  return deleted;
}

