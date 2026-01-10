import { Request, Response, NextFunction } from 'express';
import { logAudit } from '../utils/auditLogger';

/**
 * Audit Middleware Options
 */
export interface AuditMiddlewareOptions {
  action: string; // Action name (e.g., "PRICING_RULE_CREATED")
  entityType: string; // Entity type (e.g., "PricingRule")
  getEntityId?: (req: Request, res: Response) => string | null; // Extract entity ID from request/response
  getBefore?: (req: Request) => Record<string, any> | null; // Get before snapshot
  getAfter?: (req: Request, res: Response) => Record<string, any> | null; // Get after snapshot
  skipOnError?: boolean; // Skip audit if response has error
  description?: string | ((req: Request, res: Response) => string); // Description or function to generate it
  metadata?: (req: Request, res: Response) => Record<string, any>; // Additional metadata
}

/**
 * Global Audit Middleware
 * 
 * Attach to sensitive routes to automatically log actions
 * 
 * Usage:
 * ```ts
 * router.post(
 *   "/pricing-rules",
 *   authenticate,
 *   resolveStore,
 *   auditMiddleware({
 *     action: "PRICING_RULE_CREATED",
 *     entityType: "PricingRule",
 *     getEntityId: (req, res) => res.locals.createdId || req.body.id,
 *     getAfter: (req) => req.body,
 *   }),
 *   createPricingRule
 * );
 * ```
 */
export const auditMiddleware = (options: AuditMiddlewareOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original send function
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    // Capture before snapshot (if provided)
    let beforeSnapshot: Record<string, any> | null = null;
    if (options.getBefore) {
      try {
        beforeSnapshot = options.getBefore(req) || null;
      } catch (error) {
        console.error('[AUDIT MIDDLEWARE] Error getting before snapshot:', error);
      }
    }

    // Override res.send to capture response
    res.send = function (body: any) {
      // Log audit after response is sent
      setImmediate(async () => {
        await logAuditFromMiddleware(req, res, options, beforeSnapshot, body);
      });
      return originalSend(body);
    };

    res.json = function (body: any) {
      // Log audit after response is sent
      setImmediate(async () => {
        await logAuditFromMiddleware(req, res, options, beforeSnapshot, body);
      });
      return originalJson(body);
    };

    next();
  };
};

/**
 * Helper function to log audit from middleware
 */
async function logAuditFromMiddleware(
  req: Request,
  res: Response,
  options: AuditMiddlewareOptions,
  beforeSnapshot: Record<string, any> | null,
  responseBody: any
): Promise<void> {
  try {
    // Skip audit if response has error and skipOnError is true
    if (options.skipOnError && res.statusCode >= 400) {
      return;
    }

    // Extract entity ID
    let entityId: string | null = null;
    if (options.getEntityId) {
      try {
        entityId = options.getEntityId(req, res) || null;
      } catch (error) {
        console.error('[AUDIT MIDDLEWARE] Error getting entity ID:', error);
      }
    }

    // Extract after snapshot
    let afterSnapshot: Record<string, any> | null = null;
    if (options.getAfter) {
      try {
        afterSnapshot = options.getAfter(req, res) || null;
      } catch (error) {
        console.error('[AUDIT MIDDLEWARE] Error getting after snapshot:', error);
      }
    } else {
      // Default: try to extract from response body
      if (responseBody && typeof responseBody === 'object') {
        const data = responseBody.data || responseBody;
        if (data && typeof data === 'object') {
          afterSnapshot = data;
        }
      }
    }

    // Generate description
    let description: string;
    if (typeof options.description === 'function') {
      description = options.description(req, res);
    } else {
      description = options.description || `${options.action} on ${options.entityType}`;
    }

    // Extract metadata
    let metadata: Record<string, any> = {};
    if (options.metadata) {
      try {
        metadata = options.metadata(req, res) || {};
      } catch (error) {
        console.error('[AUDIT MIDDLEWARE] Error getting metadata:', error);
      }
    }

    // Log audit
    await logAudit({
      req,
      action: options.action,
      entityType: options.entityType,
      entityId: entityId || undefined,
      before: beforeSnapshot,
      after: afterSnapshot,
      description,
      metadata,
    });
  } catch (error) {
    // Never throw - audit logging failure should not break the application
    console.error('[AUDIT MIDDLEWARE] Error logging audit:', error);
  }
}

/**
 * Simple audit middleware factory for common actions
 */
export const createAuditMiddleware = (
  action: string,
  entityType: string,
  options?: Partial<AuditMiddlewareOptions>
) => {
  return auditMiddleware({
    action,
    entityType,
    ...options,
  });
};

/**
 * Pre-configured audit middlewares for common actions
 */
export const auditMiddlewares = {
  /**
   * Audit middleware for create operations
   */
  onCreate: (entityType: string, getEntityId?: (req: Request, res: Response) => string | null) =>
    auditMiddleware({
      action: `${entityType.toUpperCase()}_CREATED`,
      entityType,
      getEntityId: getEntityId || ((req, res) => {
        const body = res.locals.createdId || req.body?._id || req.body?.id;
        return body ? String(body) : null;
      }),
      getAfter: (req) => req.body,
      description: `${entityType} created`,
    }),

  /**
   * Audit middleware for update operations
   */
  onUpdate: (entityType: string, getEntityId?: (req: Request) => string | null) =>
    auditMiddleware({
      action: `${entityType.toUpperCase()}_UPDATED`,
      entityType,
      getEntityId: getEntityId || ((req) => req.params.id || null),
      getBefore: async (req) => {
        // Try to fetch existing entity (you may need to import the model)
        // This is a placeholder - implement based on your needs
        return null;
      },
      getAfter: (req) => req.body,
      description: `${entityType} updated`,
    }),

  /**
   * Audit middleware for delete operations
   */
  onDelete: (entityType: string, getEntityId?: (req: Request) => string | null) =>
    auditMiddleware({
      action: `${entityType.toUpperCase()}_DELETED`,
      entityType,
      getEntityId: getEntityId || ((req) => req.params.id || null),
      getBefore: async (req) => {
        // Try to fetch existing entity before deletion
        // This is a placeholder - implement based on your needs
        return null;
      },
      description: `${entityType} deleted`,
    }),

  /**
   * Audit middleware for login
   */
  onLogin: () =>
    auditMiddleware({
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      getEntityId: (req) => req.user?.id || null,
      description: 'User logged in successfully',
      metadata: (req) => ({
        email: req.user?.email,
        role: req.user?.role,
      }),
    }),

  /**
   * Audit middleware for logout
   */
  onLogout: () =>
    auditMiddleware({
      action: 'LOGOUT',
      entityType: 'User',
      getEntityId: (req) => req.user?.id || null,
      description: 'User logged out',
    }),
};

