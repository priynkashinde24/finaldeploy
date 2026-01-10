import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/responseFormatter';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId?: string; // Alias for id
        role: string;
        email: string;
        name?: string;
        storeId?: string; // Store ID from JWT
      };
    }
  }
}

/**
 * Authenticate middleware
 * Reads Authorization: Bearer <token>
 * Verifies access token
 * Attaches req.user = { id, role, email }
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header OR httpOnly cookie (accessToken)
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cookieToken = (req as any).cookies?.accessToken as string | undefined;
    const token = bearerToken || cookieToken;

    if (!token) {
      sendError(res, 'Authorization token required', 401);
      return;
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      sendError(res, 'Invalid or expired token', 401);
      return;
    }

    // Attach user to request (including storeId from JWT)
    req.user = {
      id: decoded.id || decoded.userId,
      role: decoded.role,
      email: decoded.email,
      storeId: decoded.storeId, // Store ID from JWT (if present)
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authenticate middleware
 * Tries to authenticate but doesn't fail if no token is provided
 * Attaches req.user if token is valid, otherwise continues without user
 */
export const authenticateOptional = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header OR httpOnly cookie (accessToken)
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cookieToken = (req as any).cookies?.accessToken as string | undefined;
    const token = bearerToken || cookieToken;

    if (!token) return next();

    // Verify token
    try {
      const decoded = verifyAccessToken(token);
      
      // Attach user to request (including storeId from JWT)
      req.user = {
        id: decoded.id || decoded.userId,
        role: decoded.role,
        email: decoded.email,
        storeId: decoded.storeId, // Store ID from JWT (if present)
      };
    } catch (error) {
      // Invalid token, continue without user (don't fail)
      // This allows the route to work without authentication
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize middleware
 * Checks if req.user.role is in allowed roles
 * Must be used after authenticate
 */
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        sendError(res, 'Authentication required', 401);
        return;
      }

      if (!roles.includes(req.user.role)) {
        sendError(res, 'Insufficient permissions', 403);
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

