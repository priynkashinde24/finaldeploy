import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

export interface RequestContextData {
  requestId: string;
  storeId: string | null;
  userId: string | null;
  role: string | null;
  ip: string;
  userAgent: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContextData;
    }
  }
}

// Middleware to attach a single source of truth request context
export const attachRequestContext = (req: Request, _res: Response, next: NextFunction) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const ip =
    (forwardedFor ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')[0].trim() : null) ||
    (Array.isArray(realIp) ? realIp[0] : realIp) ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown';

  req.context = {
    requestId: (req.headers['x-request-id'] as string) || uuid(),
    storeId: req.store?.storeId || null,
    userId: req.user?.id || null,
    role: req.user?.role || null,
    ip,
    userAgent: req.headers['user-agent'] || 'unknown',
  };
  next();
};

// Helper to ensure context is present
export const getRequestContext = (req: Request): RequestContextData => {
  if (!req.context) {
    // Fallback if middleware was not attached
    return {
      requestId: uuid(),
      storeId: req.store?.storeId || null,
      userId: req.user?.id || null,
      role: req.user?.role || null,
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };
  }
  return req.context;
};


