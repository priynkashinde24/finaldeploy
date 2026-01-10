import { Request, Response, NextFunction } from 'express';
import { Store, IStore } from '../models/Store';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { generateDomainToken, validateDomain, cleanDomain } from '../utils/domainToken';
import { z } from 'zod';

// Helper functions to generate slug, subdomain, and code
const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
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
 * Generate unique store code from name
 */
const generateUniqueCode = async (baseName: string): Promise<string> => {
  // Convert to uppercase, replace spaces/special chars with underscores
  let baseCode = baseName
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  // Ensure it's not empty
  if (!baseCode || baseCode.length < 2) {
    baseCode = 'STORE';
  }
  
  // Limit length
  if (baseCode.length > 20) {
    baseCode = baseCode.substring(0, 20);
  }
  
  let code = baseCode;
  let counter = 1;
  
  while (await Store.findOne({ code })) {
    const suffix = `_${counter}`;
    const maxLength = 20 - suffix.length;
    code = baseCode.substring(0, maxLength) + suffix;
    counter++;
  }
  
  return code;
};

// Validation schemas
const createStoreSchema = z.object({
  name: z.string().min(2, 'Store name must be at least 2 characters').max(100, 'Store name must not exceed 100 characters'),
  description: z.string().min(10, 'Store description must be at least 10 characters').max(500, 'Store description must not exceed 500 characters').optional(),
  ownerId: z.string().min(1, 'Owner ID is required').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional(),
  themeId: z.string().optional(),
  customDomain: z.string().optional(),
});

export const createStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check authentication
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Preprocess request body - convert empty strings to undefined for optional fields
    const processedBody = {
      ...req.body,
      description: req.body.description?.trim() || undefined,
      logoUrl: req.body.logoUrl?.trim() || undefined,
      ownerId: req.body.ownerId?.trim() || undefined,
      themeId: req.body.themeId?.trim() || undefined,
      customDomain: req.body.customDomain?.trim() || undefined,
    };

    // Validate request body
    const validatedData = createStoreSchema.parse(processedBody);

    // Use authenticated user's ID if ownerId not provided
    const ownerId = validatedData.ownerId || req.user.id;
    
    // Determine owner type based on user role
    const ownerType = req.user.role === 'admin' ? 'admin' : 'reseller';

    // Generate required fields from store name
    const baseSlug = generateSlug(validatedData.name);
    if (!baseSlug || baseSlug.length < 2) {
      sendError(res, 'Store name must contain at least 2 valid characters', 400);
      return;
    }

    // Generate unique slug, subdomain, and code
    const [slug, subdomain, code] = await Promise.all([
      generateUniqueSlug(baseSlug),
      generateUniqueSubdomain(baseSlug),
      generateUniqueCode(validatedData.name),
    ]);

    // Create store with validated data and defaults
    const storeData = {
      name: validatedData.name,
      code,
      slug,
      subdomain,
      description: validatedData.description || `Store created by ${req.user.email || 'user'}`,
      ownerId: ownerId,
      ownerType: ownerType,
      logoUrl: validatedData.logoUrl || 'https://via.placeholder.com/150',
      themeId: validatedData.themeId || 'default',
      status: 'active',
      ...(validatedData.customDomain && { customDomain: validatedData.customDomain }),
    };

    const store = new Store(storeData);
    await store.save();

    sendSuccess(res, store, 'Store created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const store = await Store.findById(id);

    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    sendSuccess(res, store, 'Store retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getStoresByOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ownerId } = req.query;
    
    // If ownerId is provided in query, use it
    // Otherwise, if user is authenticated, use their ID
    // Otherwise, return empty array (or require authentication)
    let targetOwnerId: string | undefined = ownerId as string | undefined;
    
    if (!targetOwnerId && req.user) {
      // Use authenticated user's ID if no ownerId provided
      targetOwnerId = req.user.id;
    }
    
    if (!targetOwnerId) {
      // No ownerId and no authenticated user - return empty array
      // (or you could require authentication here)
      sendSuccess(res, [], 'No stores found');
      return;
    }

    const stores = await Store.find({ ownerId: targetOwnerId });

    sendSuccess(res, stores, 'Stores retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const updateThemeSchema = z.object({
  themeId: z.string().min(1, 'Theme ID is required'),
});

export const updateStoreTheme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Validate request body
    const validatedData = updateThemeSchema.parse(req.body);

    // Update store theme
    const store = await Store.findByIdAndUpdate(
      id,
      { themeId: validatedData.themeId },
      { new: true, runValidators: true }
    );

    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    sendSuccess(res, store, 'Store theme updated successfully');
  } catch (error) {
    next(error);
  }
};

const setDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
});

export const setStoreDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Validate request body
    const validatedData = setDomainSchema.parse(req.body);
    const rawDomain = validatedData.domain;

    // Clean and validate domain
    const cleanedDomain = cleanDomain(rawDomain);
    
    if (!validateDomain(cleanedDomain)) {
      sendError(res, 'Invalid domain format', 400);
      return;
    }

    // Generate DNS verification token
    const dnsToken = generateDomainToken();

    // Update store with domain and token
    const store = await Store.findByIdAndUpdate(
      id,
      {
        customDomain: cleanedDomain,
        domainStatus: 'pending',
        dnsVerificationToken: dnsToken,
      },
      { new: true, runValidators: true }
    );

    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    // Return domain info with DNS instructions
    sendSuccess(
      res,
      {
        domain: store.customDomain,
        domainStatus: store.domainStatus,
        dnsVerificationToken: store.dnsVerificationToken,
        dnsInstructions: {
          recordType: 'TXT',
          recordName: `_revocart.${cleanedDomain}`,
          recordValue: store.dnsVerificationToken,
          instruction: `Add a TXT record: _revocart.${cleanedDomain} = ${store.dnsVerificationToken}`,
        },
      },
      'Domain configured successfully. Please add the DNS record to verify.'
    );
  } catch (error) {
    next(error);
  }
};

export const verifyStoreDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const store = await Store.findById(id);

    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    if (!store.customDomain || !store.dnsVerificationToken) {
      sendError(res, 'No domain configured for this store', 400);
      return;
    }

    // TODO: Implement actual DNS verification
    // For now, return pending status
    // In production, this would:
    // 1. Query DNS for TXT record at _revocart.{domain}
    // 2. Compare with stored token
    // 3. Update domainStatus to 'verified' if match
    // 4. Trigger SSL certificate issuance

    const status = store.domainStatus || 'pending';

    sendSuccess(
      res,
      {
        domain: store.customDomain,
        domainStatus: status,
        verified: status === 'verified',
        message: status === 'verified' 
          ? 'Domain is verified and ready to use'
          : status === 'pending'
          ? 'Domain verification is pending. Please ensure DNS records are configured correctly.'
          : 'Domain verification failed. Please check your DNS configuration.',
      },
      'Domain verification status retrieved'
    );
  } catch (error) {
    next(error);
  }
};

