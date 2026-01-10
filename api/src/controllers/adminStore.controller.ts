import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Store } from '../models/Store';
import { StorePriceOverride } from '../models/StorePriceOverride';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

// Validation schemas
const createStoreSchema = z.object({
  name: z.string().min(1, 'Store name is required').max(100, 'Store name must not exceed 100 characters'),
  code: z.string().min(1, 'Store code is required').regex(/^[A-Z0-9_]+$/, 'Store code must be uppercase alphanumeric with underscores'),
  ownerType: z.enum(['admin', 'reseller']).default('admin'),
  ownerId: z.string().optional(), // Optional, defaults to current admin
  status: z.enum(['active', 'suspended']).optional().default('active'), // Updated to match new status enum
  description: z.string().max(500).optional(),
});

const updateStoreSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).regex(/^[A-Z0-9_]+$/).optional(),
  status: z.enum(['active', 'suspended']).optional(), // Updated to match new status enum
  description: z.string().max(500).optional(),
  ownerId: z.string().optional(), // Assign new owner
  subdomain: z.string().optional(),
  customDomain: z.string().optional(),
  domain: z.string().optional(),
});

const createPriceOverrideSchema = z.object({
  scope: z.enum(['product', 'variant', 'category']),
  scopeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid scope ID'),
  overrideType: z.enum(['fixed_price', 'price_delta']),
  overrideValue: z.number(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

const updatePriceOverrideSchema = z.object({
  overrideType: z.enum(['fixed_price', 'price_delta']).optional(),
  overrideValue: z.number().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * Admin Store Controller
 * 
 * PURPOSE:
 * - Admin-only store management
 * - Create, read, update, disable stores
 * - Manage store-specific price overrides
 * 
 * RULES:
 * - Only admins can create/modify stores
 * - Store codes must be unique
 * - Price overrides respect admin pricing rules
 */

/**
 * POST /admin/stores
 * Create a new store (admin only)
 */
export const createStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create stores', 403);
      return;
    }

    // Validate request body
    const validatedData = createStoreSchema.parse(req.body);

    // Check if code already exists
    const existingStore = await Store.findOne({ code: validatedData.code.toUpperCase() });
    if (existingStore) {
      sendError(res, 'Store with this code already exists', 400);
      return;
    }

    // Create store
    const store = new Store({
      name: validatedData.name,
      code: validatedData.code.toUpperCase(),
      ownerType: validatedData.ownerType || 'admin',
      ownerId: validatedData.ownerId || currentUser.id,
      status: validatedData.status || 'active',
      description: validatedData.description,
      slug: validatedData.code.toLowerCase().replace(/_/g, '-'), // Auto-generate slug from code
      subdomain: validatedData.code.toLowerCase().replace(/_/g, '-'), // Auto-generate subdomain
      themeId: 'default',
    });

    await store.save();

    // Audit log: Store created
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'STORE_CREATED',
        entityType: 'Store',
        entityId: store._id.toString(),
        before: null,
        after: store.toObject(),
        description: 'Store created',
        metadata: {
          storeId: store._id.toString(),
          ownerId: store.ownerId,
          code: store.code,
          subdomain: store.subdomain,
        },
      });
    } catch (err) {
      console.error('[AUDIT] STORE_CREATED failed:', err);
    }

    sendSuccess(res, { store }, 'Store created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/stores
 * List all stores (admin only)
 */
export const listStores = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view stores', 403);
      return;
    }

    // Query parameters
    const status = req.query.status as string | undefined;
    const ownerType = req.query.ownerType as string | undefined;

    // Build query
    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (ownerType) {
      query.ownerType = ownerType;
    }

    // Fetch stores
    const stores = await Store.find(query).sort({ createdAt: -1 });

    sendSuccess(res, { stores, count: stores.length }, 'Stores retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/stores/:id
 * Get a single store (admin only)
 */
export const getStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view stores', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Find store
    const store = await Store.findById(id);

    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    sendSuccess(res, { store }, 'Store retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/stores/:id
 * Update a store (admin only)
 */
export const updateStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update stores', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Validate request body
    const validatedData = updateStoreSchema.parse(req.body);

    // Find store
    const store = await Store.findById(id);
    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    // Check if code already exists (if changing code)
    if (validatedData.code && validatedData.code.toUpperCase() !== store.code) {
      const existingStore = await Store.findOne({
        code: validatedData.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (existingStore) {
        sendError(res, 'Store with this code already exists', 400);
        return;
      }
      validatedData.code = validatedData.code.toUpperCase();
    }

    const before = store.toObject();

    // Update store
    if (validatedData.ownerId) {
      // Verify owner exists
      const { User } = await import('../models/User');
      const owner = await User.findById(validatedData.ownerId);
      if (!owner) {
        sendError(res, 'Owner user not found', 404);
        return;
      }
      store.ownerId = validatedData.ownerId;
    }
    
    if (validatedData.status) {
      store.status = validatedData.status;
    }
    
    if (validatedData.name) {
      store.name = validatedData.name;
    }
    
    if (validatedData.description !== undefined) {
      store.description = validatedData.description;
    }
    
    if (validatedData.subdomain) {
      // Check if subdomain is unique
      const existingStore = await Store.findOne({
        subdomain: validatedData.subdomain.toLowerCase(),
        _id: { $ne: id },
      });
      if (existingStore) {
        sendError(res, 'Subdomain already in use', 400);
        return;
      }
      store.subdomain = validatedData.subdomain.toLowerCase();
    }
    
    if (validatedData.customDomain || validatedData.domain) {
      const domain = validatedData.customDomain || validatedData.domain;
      // Check if domain is unique
      const existingStore = await Store.findOne({
        $or: [
          { customDomain: domain?.toLowerCase() },
        ],
        _id: { $ne: id },
      });
      if (existingStore) {
        sendError(res, 'Domain already in use', 400);
        return;
      }
      store.customDomain = domain?.toLowerCase();
      // Note: domain field is an alias for customDomain in the model
    }
    
    await store.save();

    // Audit log: Store updated
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'STORE_UPDATED',
        entityType: 'Store',
        entityId: store._id.toString(),
        before,
        after: store.toObject(),
        description: `Store updated`,
        metadata: {
          storeId: store._id.toString(),
          updatedFields: Object.keys(validatedData),
        },
      });
    } catch (err) {
      console.error('[AUDIT] STORE_UPDATED failed:', err);
    }

    sendSuccess(res, { store }, 'Store updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/stores/:id/disable
 * Disable a store (admin only)
 */
export const disableStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable stores', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Find store
    const store = await Store.findById(id);
    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    const before = store.toObject();
    // Suspend store
    store.status = 'suspended';
    await store.save();

    // Audit log: Store suspended
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'STORE_SUSPENDED',
        entityType: 'Store',
        entityId: store._id.toString(),
        before,
        after: store.toObject(),
        description: `Store suspended`,
        metadata: {
          storeId: store._id.toString(),
        },
      });
    } catch (err) {
      console.error('[AUDIT] STORE_SUSPENDED failed:', err);
    }

    sendSuccess(res, { store }, 'Store suspended successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/stores/:id/price-overrides
 * Create a price override for a store (admin only)
 */
export const createPriceOverride = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create price overrides', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Validate request body
    const validatedData = createPriceOverrideSchema.parse(req.body);

    // Find store
    const store = await Store.findById(id);
    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    // Check if active override already exists
    if (validatedData.status === 'active') {
      const existingOverride = await StorePriceOverride.findOne({
        storeId: id,
        scope: validatedData.scope,
        scopeId: validatedData.scopeId,
        status: 'active',
      });
      if (existingOverride) {
        sendError(res, 'An active price override already exists for this store and scope', 400);
        return;
      }
    }

    const before = null;
    // Create price override
    const priceOverride = new StorePriceOverride({
      storeId: new mongoose.Types.ObjectId(id),
      scope: validatedData.scope,
      scopeId: new mongoose.Types.ObjectId(validatedData.scopeId),
      overrideType: validatedData.overrideType,
      overrideValue: validatedData.overrideValue,
      status: validatedData.status || 'active',
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await priceOverride.save();

    // Populate references for response
    await priceOverride.populate('storeId', 'name code');
    await priceOverride.populate('createdBy', 'name email');

    // Audit log: Price override created
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'PRICE_OVERRIDE_CREATED',
        entityType: 'StorePriceOverride',
        entityId: priceOverride._id.toString(),
        before,
        after: priceOverride.toObject(),
        description: `Price override created`,
        metadata: {
          storeId: id,
          scope: validatedData.scope,
          scopeId: validatedData.scopeId,
        },
      });
    } catch (err) {
      console.error('[AUDIT] PRICE_OVERRIDE_CREATED failed:', err);
    }

    sendSuccess(res, { priceOverride }, 'Price override created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/stores/:id/price-overrides
 * List all price overrides for a store (admin only)
 */
export const listPriceOverrides = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view price overrides', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Query parameters
    const status = req.query.status as string | undefined;
    const scope = req.query.scope as string | undefined;

    // Build query
    const query: any = { storeId: id };
    if (status) {
      query.status = status;
    }
    if (scope) {
      query.scope = scope;
    }

    // Fetch price overrides
    const priceOverrides = await StorePriceOverride.find(query)
      .populate('storeId', 'name code')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    sendSuccess(res, { priceOverrides, count: priceOverrides.length }, 'Price overrides retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/stores/:id/price-overrides/:overrideId
 * Update a price override (admin only)
 */
export const updatePriceOverride = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update price overrides', 403);
      return;
    }

    const { id, overrideId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(overrideId)) {
      sendError(res, 'Invalid store ID or override ID', 400);
      return;
    }

    // Validate request body
    const validatedData = updatePriceOverrideSchema.parse(req.body);

    // Find price override
    const priceOverride = await StorePriceOverride.findOne({
      _id: overrideId,
      storeId: id,
    });

    if (!priceOverride) {
      sendError(res, 'Price override not found', 404);
      return;
    }

    const before = priceOverride.toObject();
    // Update price override
    Object.assign(priceOverride, validatedData);
    await priceOverride.save();

    // Populate references for response
    await priceOverride.populate('storeId', 'name code');
    await priceOverride.populate('createdBy', 'name email');

    // Audit log: Price override updated
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'PRICE_OVERRIDE_UPDATED',
        entityType: 'StorePriceOverride',
        entityId: priceOverride._id.toString(),
        before,
        after: priceOverride.toObject(),
        description: `Price override updated`,
        metadata: {
          storeId: id,
          scope: priceOverride.scope,
          scopeId: priceOverride.scopeId?.toString(),
          updatedFields: Object.keys(validatedData),
        },
      });
    } catch (err) {
      console.error('[AUDIT] PRICE_OVERRIDE_UPDATED failed:', err);
    }

    sendSuccess(res, { priceOverride }, 'Price override updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/stores/:id/price-overrides/:overrideId/disable
 * Disable a price override (admin only)
 */
export const disablePriceOverride = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable price overrides', 403);
      return;
    }

    const { id, overrideId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(overrideId)) {
      sendError(res, 'Invalid store ID or override ID', 400);
      return;
    }

    // Find price override
    const priceOverride = await StorePriceOverride.findOne({
      _id: overrideId,
      storeId: id,
    });

    if (!priceOverride) {
      sendError(res, 'Price override not found', 404);
      return;
    }

    const before = priceOverride.toObject();
    // Disable price override
    priceOverride.status = 'inactive';
    await priceOverride.save();

    // Populate references for response
    await priceOverride.populate('storeId', 'name code');
    await priceOverride.populate('createdBy', 'name email');

    // Audit log: Price override disabled
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'PRICE_OVERRIDE_DISABLED',
        entityType: 'StorePriceOverride',
        entityId: priceOverride._id.toString(),
        before,
        after: priceOverride.toObject(),
        description: `Price override disabled`,
        metadata: {
          storeId: id,
          scope: priceOverride.scope,
          scopeId: priceOverride.scopeId?.toString(),
        },
      });
    } catch (err) {
      console.error('[AUDIT] PRICE_OVERRIDE_DISABLED failed:', err);
    }

    sendSuccess(res, { priceOverride }, 'Price override disabled successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/stores/:id/usage
 * Get store usage statistics (admin only)
 */
export const getStoreUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view store usage', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Find store
    const store = await Store.findById(id);
    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    // Get usage statistics
    const { Product } = await import('../models/Product');
    const { Order } = await import('../models/Order');
    const { Subscription } = await import('../models/Subscription');
    const { User } = await import('../models/User');

    const productCount = await Product.countDocuments({ storeId: id });
    const orderCount = await Order.countDocuments({ storeId: id });
    const paidOrderCount = await Order.countDocuments({ storeId: id, status: 'paid' });
    
    // Calculate total revenue
    const paidOrders = await Order.find({ storeId: id, status: 'paid' }).lean();
    const totalRevenue = paidOrders.reduce((sum, order) => {
      return sum + (order.totalAmountWithTax || order.finalAmount || order.totalAmount || 0);
    }, 0);

    // Get subscription info
    const subscription = await Subscription.findOne({ storeId: id, status: { $in: ['trial', 'active', 'past_due'] } });
    
    // Get owner info
    const owner = await User.findById(store.ownerId).select('name email role');

    // Get recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrderCount = await Order.countDocuments({
      storeId: id,
      createdAt: { $gte: thirtyDaysAgo },
    });

    const usage = {
      store: {
        id: store._id.toString(),
        name: store.name,
        slug: store.slug,
        status: store.status,
        createdAt: store.createdAt,
      },
      owner: owner ? {
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
        role: owner.role,
      } : null,
      subscription: subscription ? {
        id: subscription._id.toString(),
        planId: subscription.planId.toString(),
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      } : null,
      statistics: {
        products: productCount,
        totalOrders: orderCount,
        paidOrders: paidOrderCount,
        totalRevenue: totalRevenue,
        recentOrders30Days: recentOrderCount,
      },
    };

    sendSuccess(res, { usage }, 'Store usage retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/stores/:id/suspend
 * Suspend a store (admin only) - alias for status update
 */
export const suspendStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can suspend stores', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Find store
    const store = await Store.findById(id);
    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    const before = store.toObject();

    // Suspend store
    store.status = 'suspended';
    await store.save();

    // Audit log: Store suspended (alias)
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'STORE_SUSPENDED',
        entityType: 'Store',
        entityId: store._id.toString(),
        before,
        after: store.toObject(),
        description: `Store suspended`,
        metadata: {
          storeId: store._id.toString(),
        },
      });
    } catch (err) {
      console.error('[AUDIT] STORE_SUSPENDED failed:', err);
    }

    sendSuccess(res, { store }, 'Store suspended successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/stores/:id/activate
 * Activate a suspended store (admin only)
 */
export const activateStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can activate stores', 403);
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid store ID', 400);
      return;
    }

    // Find store
    const store = await Store.findById(id);
    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    const before = store.toObject();

    // Activate store
    store.status = 'active';
    await store.save();

    // Audit log: Store activated
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'STORE_ACTIVATED',
        entityType: 'Store',
        entityId: store._id.toString(),
        before,
        after: store.toObject(),
        description: `Store activated`,
        metadata: {
          storeId: store._id.toString(),
        },
      });
    } catch (err) {
      console.error('[AUDIT] STORE_ACTIVATED failed:', err);
    }

    sendSuccess(res, { store }, 'Store activated successfully');
  } catch (error) {
    next(error);
  }
};

