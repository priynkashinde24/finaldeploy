import { Request, Response, NextFunction } from 'express';
import { Store } from '../models/Store';
import { sendError } from '../utils/responseFormatter';

/**
 * Store resolution result attached to request
 */
export interface StoreContext {
  storeId: string;
  store: any; // Store document
}

/**
 * Extend Express Request to include store context
 */
declare global {
  namespace Express {
    interface Request {
      store?: StoreContext;
    }
  }
}

/**
 * Store Resolution Middleware
 * 
 * Resolves store (tenant) from request using priority:
 * 1. x-store-id header
 * 2. Subdomain (from Host header)
 * 3. Domain (from Host header)
 * 
 * Attaches req.store with storeId and store document
 * Rejects if store not found or inactive
 */
export const resolveStore = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let store = null;
    let storeId: string | null = null;

    // Priority 1: Check x-store-id header
    const headerStoreId = req.headers['x-store-id'] as string;
    if (headerStoreId) {
      store = await Store.findById(headerStoreId);
      if (store) {
        storeId = store._id.toString();
        console.log('[STORE RESOLUTION] Resolved from header:', { storeId, name: store.name });
      }
    }

    // Priority 2: Check subdomain (if not resolved from header)
    if (!store) {
      const host = (req.headers.host || req.headers['x-forwarded-host'] || '') as string | string[];
      const hostStr = Array.isArray(host) ? host[0] : host;
      const hostname = hostStr.split(':')[0]; // Remove port if present
      
      // Extract subdomain (e.g., "myshop.yourapp.com" -> "myshop")
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        // Has subdomain (e.g., myshop.yourapp.com)
        const subdomain = parts[0].toLowerCase();
        store = await Store.findOne({ 
          subdomain: subdomain,
          status: 'active' // Only active stores
        });
        if (store) {
          storeId = store._id.toString();
          console.log('[STORE RESOLUTION] Resolved from subdomain:', { subdomain, storeId, name: store.name });
        }
      }
    }

    // Priority 3: Check custom domain (if not resolved from header or subdomain)
    if (!store) {
      const host = (req.headers.host || req.headers['x-forwarded-host'] || '') as string | string[];
      const hostStr = Array.isArray(host) ? host[0] : host;
      const hostname = hostStr.split(':')[0].toLowerCase();
      
      store = await Store.findOne({
        $or: [
          { customDomain: hostname },
          { domain: hostname }
        ],
        status: 'active' // Only active stores
      });
      if (store) {
        storeId = store._id.toString();
        console.log('[STORE RESOLUTION] Resolved from domain:', { hostname, storeId, name: store.name });
      }
    }

    // If still not resolved, reject request
    if (!store || !storeId) {
      console.error('[STORE RESOLUTION] Store not found:', {
        host: req.headers.host,
        'x-store-id': req.headers['x-store-id'],
      });
      sendError(res, 'Store not found or invalid', 404);
      return;
    }

    // Check if store is active (should already be filtered, but double-check)
    if (store.status !== 'active') {
      console.error('[STORE RESOLUTION] Store is not active:', { storeId, status: store.status });
      sendError(res, 'Store is suspended', 403);
      return;
    }

    // Attach store context to request
    req.store = {
      storeId,
      store: store.toObject(), // Convert to plain object
    };

    next();
  } catch (error) {
    console.error('[STORE RESOLUTION] Error resolving store:', error);
    sendError(res, 'Failed to resolve store', 500);
  }
};

/**
 * Optional: Store resolution middleware that allows public routes
 * Use this for routes that don't require store context (e.g., health check, auth)
 */
export const resolveStoreOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to resolve store, but don't fail if not found
    let store = null;
    let storeId: string | null = null;

    // Priority 1: Check x-store-id header
    const headerStoreId = req.headers['x-store-id'] as string;
    if (headerStoreId) {
      store = await Store.findById(headerStoreId);
      if (store) {
        storeId = store._id.toString();
      }
    }

    // Priority 2: Check subdomain
    if (!store) {
      const host = (req.headers.host || req.headers['x-forwarded-host'] || '') as string | string[];
      const hostStr = Array.isArray(host) ? host[0] : host;
      const hostname = hostStr.split(':')[0];
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0].toLowerCase();
        store = await Store.findOne({ 
          subdomain: subdomain,
          status: 'active'
        });
        if (store) {
          storeId = store._id.toString();
        }
      }
    }

    // Priority 3: Check custom domain
    if (!store) {
      const host = (req.headers.host || req.headers['x-forwarded-host'] || '') as string | string[];
      const hostStr = Array.isArray(host) ? host[0] : host;
      const hostname = hostStr.split(':')[0].toLowerCase();
      store = await Store.findOne({
        $or: [
          { customDomain: hostname },
          { domain: hostname }
        ],
        status: 'active'
      });
      if (store) {
        storeId = store._id.toString();
      }
    }

    // Attach store context if found (optional)
    if (store && storeId) {
      req.store = {
        storeId,
        store: store.toObject(),
      };
    }

    next();
  } catch (error) {
    // Don't fail on error, just continue without store context
    console.error('[STORE RESOLUTION] Optional resolution error:', error);
    next();
  }
};

