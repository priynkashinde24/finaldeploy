import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { IPRestriction } from '../models/IPRestriction';
import { matchIP } from '../utils/ipMatcher';
import { logSecurityEvent } from '../utils/securityLogger';

const ADMIN_WHITELIST = (process.env.ADMIN_WHITELIST_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

// Paths to ignore (e.g., webhooks/health/auth)
// Auth must stay reachable even if IP restriction rules are configured (otherwise users can't log in).
const IGNORE_PATHS = [
  '/health',
  '/api/health',
  '/api/webhooks',
  '/webhooks',
  '/api/auth',
  '/auth',
];

// Query timeout in milliseconds (5 seconds)
const QUERY_TIMEOUT = 5000;

/**
 * Check if MongoDB is connected and ready
 */
function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1; // 1 = connected
}

/**
 * Fetch IP restriction rules with timeout and error handling
 */
async function fetchIPRules(storeId: string | null, userId: string | null, role: string | null): Promise<any[]> {
  // Check if DB is connected - silently skip if not (normal during startup)
  if (!isDbConnected()) {
    return []; // Fail-open: allow requests when DB is not connected
  }

  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('IP restriction query timeout'));
      }, QUERY_TIMEOUT);
    });

    // Create the query promise
    const queryPromise = IPRestriction.find({
      status: 'active',
      scope: { $in: ['global', 'store', 'role', 'user'] },
      $or: [
        { scope: 'global' },
        { scope: 'store', scopeId: storeId },
        { scope: 'role', scopeId: role },
        { scope: 'user', scopeId: userId },
      ],
    })
      .lean()
      .maxTimeMS(QUERY_TIMEOUT); // Set MongoDB query timeout

    // Race between query and timeout
    const rules = await Promise.race([queryPromise, timeoutPromise]);
    return rules as any[];
  } catch (error: any) {
    // Handle Mongoose errors and timeouts
    if (
      error.name === 'MongooseError' ||
      error.message?.includes('timeout') ||
      error.message?.includes('buffering')
    ) {
      console.warn('[IP RESTRICTION] Database query failed or timed out, allowing request:', error.message);
      return []; // Return empty array to allow request (fail-open)
    }
    throw error; // Re-throw other errors
  }
}

export const ipRestriction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip ignored paths - use originalUrl to get full path including /api prefix
    const requestPath = req.originalUrl || req.url || req.path;
    if (IGNORE_PATHS.some((p) => requestPath.startsWith(p))) {
      next();
      return;
    }

    // Extract IP
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    let ip =
      (forwardedFor ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')[0].trim() : null) ||
      (Array.isArray(realIp) ? realIp[0] : realIp) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    // Normalize IPv6 localhost
    if (ip === '::1') ip = '127.0.0.1';

    // Admin whitelist
    if (req.user?.role === 'admin' && ADMIN_WHITELIST.includes(ip)) {
      return next();
    }

    const storeId = req.store?.storeId || null;
    const userId = req.user?.id || null;
    const role = req.user?.role || null;

    // Fetch active rules relevant to request with timeout handling
    const rules = await fetchIPRules(storeId, userId, role);

    // If no rules found (either no rules exist or DB query failed), allow request
    if (!rules || rules.length === 0) {
      return next();
    }

    const denyRules = rules.filter((r) => r.ruleType === 'deny');
    const allowRules = rules.filter((r) => r.ruleType === 'allow');

    const denyMatched = denyRules.some((rule) => matchIP(ip, rule.ipRange));
    if (denyMatched) {
      try {
        await logSecurityEvent({
          req,
          eventType: 'IP_BLOCKED',
          severity: 'high',
          metadata: {
            ip,
            reason: 'deny_rule_match',
          },
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        console.warn('[IP RESTRICTION] Failed to log security event:', logError);
      }
      res.status(403).json({ success: false, message: 'Access denied from this IP' });
      return;
    }

    if (allowRules.length > 0) {
      const allowMatched = allowRules.some((rule) => matchIP(ip, rule.ipRange));
      if (!allowMatched) {
        try {
          await logSecurityEvent({
            req,
            eventType: 'IP_BLOCKED',
            severity: 'medium',
            metadata: {
              ip,
              reason: 'no_allow_match',
            },
          });
        } catch (logError) {
          // Don't fail the request if logging fails
          console.warn('[IP RESTRICTION] Failed to log security event:', logError);
        }
        res.status(403).json({ success: false, message: 'Access not allowed from this IP' });
        return;
      }
    }

    next();
  } catch (error: any) {
    // Catch any unexpected errors and allow request (fail-open)
    // This prevents the middleware from blocking all requests if something goes wrong
    console.error('[IP RESTRICTION] Unexpected error, allowing request:', error);
    next();
  }
};


