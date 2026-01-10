import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { sendError } from '../utils/responseFormatter';

/**
 * Verify Store Access Middleware
 * 
 * Ensures user has access to the resolved store
 * Must be used AFTER resolveStore and authenticate middleware
 * 
 * Rules:
 * - Admins have access to all stores
 * - Store owners have access to their store
 * - Users with store in accessibleStores have access
 * - Users with defaultStoreId matching have access
 */
export const verifyStoreAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Store must be resolved
    if (!req.store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    // User must be authenticated
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const storeId = req.store.storeId;
    const userId = req.user.id;

    // Admins have access to all stores
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Get user with store access info
    const user = await User.findById(userId).select('defaultStoreId accessibleStores');
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Check if user is store owner
    const store = await Store.findById(storeId);
    if (!store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    const isOwner = store.ownerId === userId;

    // Check if store is in accessible stores
    const hasAccess = user.accessibleStores.some(
      (id) => id.toString() === storeId
    );

    // Check if store is default store
    const isDefaultStore = user.defaultStoreId?.toString() === storeId;

    // Grant access if user is owner, has access, or it's their default store
    if (isOwner || hasAccess || isDefaultStore) {
      next();
      return;
    }

    // Deny access
    console.error('[STORE ACCESS] Access denied:', {
      userId,
      storeId,
      isOwner,
      hasAccess,
      isDefaultStore,
    });
    sendError(res, 'You do not have access to this store', 403);
  } catch (error) {
    console.error('[STORE ACCESS] Error verifying store access:', error);
    sendError(res, 'Failed to verify store access', 500);
  }
};

