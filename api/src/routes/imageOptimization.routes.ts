import { Router } from 'express';
import {
  optimizeSingleImage,
  generateResponsive,
  generateThumb,
  getOptimizedImage,
  getImageVariant,
  getMetadata,
  listOptimizedImages,
} from '../controllers/imageOptimization.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import { imageUpload } from '../utils/imageUpload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/images/optimize - Optimize single image
router.post('/optimize', resolveStore, imageUpload.single('image'), optimizeSingleImage);

// POST /api/images/generate-responsive - Generate responsive image sizes
router.post('/generate-responsive', resolveStore, imageUpload.single('image'), generateResponsive);

// POST /api/images/generate-thumbnail - Generate thumbnail
router.post('/generate-thumbnail', imageUpload.single('image'), generateThumb);

// GET /api/images/metadata - Get image metadata
router.post('/metadata', imageUpload.single('image'), getMetadata);

// GET /api/images - List optimized images
router.get('/', resolveStore, listOptimizedImages);

// GET /api/images/:imageId - Get optimized image details
router.get('/:imageId', resolveStore, getOptimizedImage);

// GET /api/images/:imageId/variant/:size - Get specific variant
router.get('/:imageId/variant/:size', getImageVariant);

export default router;

