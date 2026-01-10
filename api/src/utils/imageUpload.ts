import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * Image Upload Configuration
 * 
 * PURPOSE:
 * - Configure multer for image uploads
 * - Validate image file types
 * - Set size limits
 * - Generate unique filenames
 */

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Configure storage for image uploads
 */
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'images', 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img-${uniqueSuffix}${ext}`);
  },
});

/**
 * File filter for images
 */
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isValidExtension = ALLOWED_EXTENSIONS.includes(ext);

  if (isValidMimeType && isValidExtension) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

/**
 * Multer configuration for image uploads
 */
export const imageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file upload
  },
});

/**
 * Multer configuration for multiple image uploads
 */
export const multipleImageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Up to 10 files
  },
});

/**
 * Get file URL (for CDN integration)
 */
export function getImageUrl(filename: string, basePath: string = '/uploads/images'): string {
  return `${basePath}/${filename}`;
}

/**
 * Validate image file
 */
export function validateImageFile(file: Express.Multer.File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isValidExtension = ALLOWED_EXTENSIONS.includes(ext);

  if (!isValidMimeType || !isValidExtension) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

