import { Request, Response, NextFunction } from 'express';
import { Store, IStore } from '../models/Store';
import { StorePage } from '../models/StorePage';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { getThemeById, isValidThemeId } from '../config/themes';
import { z } from 'zod';

// Store limit per reseller (configurable via env)
const MAX_STORES_PER_RESELLER = parseInt(process.env.MAX_STORES_PER_RESELLER || '10', 10);

// Validation schema for store creation
const createStoreSchema = z.object({
  name: z
    .string()
    .min(2, 'Store name must be at least 2 characters')
    .max(100, 'Store name must not exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Store name can only contain letters, numbers, spaces, hyphens, and underscores'),
  themeId: z.string().min(1, 'Theme ID is required'),
});

/**
 * Generate slug from store name
 */
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Generate unique slug with fallback
 */
const generateUniqueSlug = async (baseSlug: string): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;
  
  while (await Store.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
};

/**
 * Generate unique subdomain
 */
const generateUniqueSubdomain = async (baseSlug: string): Promise<string> => {
  let subdomain = baseSlug;
  let counter = 1;
  
  while (await Store.findOne({ subdomain })) {
    subdomain = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return subdomain;
};

/**
 * Create default pages for a store
 */
const createDefaultPages = async (storeId: string): Promise<void> => {
  const pageTypes: Array<'home' | 'products' | 'product-detail' | 'cart' | 'checkout' | 'contact'> = [
    'home',
    'products',
    'product-detail',
    'cart',
    'checkout',
    'contact',
  ];

  const defaultBlocks = {
    home: {
      hero: {
        title: 'Welcome to Our Store',
        subtitle: 'Discover amazing products',
        ctaText: 'Shop Now',
        ctaLink: '/products',
      },
      featured: {
        title: 'Featured Products',
        products: [],
      },
    },
    products: {
      title: 'Our Products',
      filters: {
        category: true,
        price: true,
        sort: true,
      },
    },
    'product-detail': {
      layout: 'standard',
      showRelated: true,
      showReviews: true,
    },
    cart: {
      title: 'Shopping Cart',
      showSuggestions: true,
    },
    checkout: {
      title: 'Checkout',
      steps: ['cart', 'shipping', 'payment', 'review'],
    },
    contact: {
      title: 'Contact Us',
      form: {
        fields: ['name', 'email', 'message'],
      },
    },
  };

  for (const pageType of pageTypes) {
    await StorePage.create({
      storeId,
      pageType,
      blocks: defaultBlocks[pageType] || {},
      version: 1,
      isActive: true,
    });
  }
};

/**
 * POST /stores/create
 * Create a new store (one-click creation)
 * Only resellers can create stores
 */
export const createStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check authentication
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Check authorization - only resellers can create stores
    if (req.user.role !== 'reseller' && req.user.role !== 'admin') {
      sendError(res, 'Only resellers can create stores', 403);
      return;
    }

    // Check store limit
    const existingStoresCount = await Store.countDocuments({ ownerId: req.user.id });
    if (existingStoresCount >= MAX_STORES_PER_RESELLER) {
      sendError(
        res,
        `Store limit reached. Maximum ${MAX_STORES_PER_RESELLER} stores allowed per reseller.`,
        403
      );
      return;
    }

    // Validate request body
    const validatedData = createStoreSchema.parse(req.body);
    const { name, themeId } = validatedData;

    // Validate theme ID
    if (!isValidThemeId(themeId)) {
      sendError(res, 'Invalid theme ID', 400);
      return;
    }

    // Get theme config for default branding
    const theme = getThemeById(themeId);
    if (!theme) {
      sendError(res, 'Theme not found', 404);
      return;
    }

    // Generate slug and subdomain
    const baseSlug = generateSlug(name);
    if (!baseSlug || baseSlug.length < 2) {
      sendError(res, 'Store name must contain at least 2 valid characters', 400);
      return;
    }

    const slug = await generateUniqueSlug(baseSlug);
    const subdomain = await generateUniqueSubdomain(baseSlug);

    // Create store
    const store = new Store({
      ownerId: req.user.id,
      name: name.trim(),
      slug,
      subdomain,
      themeId,
      status: 'active',
      branding: {
        logo: '',
        primaryColor: theme.defaultColors.primary,
        font: theme.defaultFonts.heading,
      },
    });

    await store.save();

    // Create default pages
    await createDefaultPages(store._id.toString());

    // Return store details
    sendSuccess(
      res,
      {
        _id: store._id,
        name: store.name,
        slug: store.slug,
        subdomain: store.subdomain,
        subdomainUrl: `${store.subdomain}.revocart.com`,
        themeId: store.themeId,
        status: store.status,
        branding: store.branding,
        createdAt: store.createdAt,
      },
      'Store created successfully',
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, 'Validation error', 400, error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })));
      return;
    }

    // Handle duplicate key errors (slug/subdomain)
    if ((error as any).code === 11000) {
      const field = Object.keys((error as any).keyPattern || {})[0];
      sendError(res, `Store ${field} already exists. Please try a different name.`, 409);
      return;
    }

    next(error);
  }
};

/**
 * GET /stores/themes
 * Get all available themes
 */
export const getThemes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { getAllThemes } = await import('../config/themes');
    const themes = getAllThemes();
    
    sendSuccess(
      res,
      themes.map((theme) => ({
        themeId: theme.themeId,
        name: theme.name,
        previewImage: theme.previewImage,
        defaultColors: theme.defaultColors,
        defaultFonts: theme.defaultFonts,
      })),
      'Themes retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

