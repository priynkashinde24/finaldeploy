import { Request, Response, NextFunction } from 'express';
import {
  checkThrottle,
  checkThrottleRule,
  getThrottleIdentifier,
  ThrottleConfig,
} from '../services/throttling.service';
import { ThrottleRule } from '../models/ThrottleRule';
import { sendError } from '../utils/responseFormatter';
import { logAudit } from '../utils/auditLogger';

/**
 * Throttling Middleware
 * 
 * PURPOSE:
 * - Apply throttling to routes
 * - Check rules from database
 * - Return appropriate error responses
 * - Log throttling events
 */

/**
 * Middleware to apply throttling with custom config
 */
export function throttleMiddleware(config: ThrottleConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await checkThrottle(req, config);

      if (!result.allowed) {
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString());
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }

        // Log audit event
        await logAudit({
          req,
          action: 'THROTTLE_LIMIT_EXCEEDED',
          entityType: 'Throttle',
          description: `Throttle limit exceeded: ${result.reason || 'Rate limit exceeded'}`,
          metadata: {
            scope: config.scope,
            identifier: getThrottleIdentifier(req, config.scope),
            strategy: config.strategy,
            retryAfter: result.retryAfter,
          },
        }).catch((err) => {
          console.error('[THROTTLING] Failed to log audit:', err);
        });

        // Set retry headers
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }
        if (result.resetTime) {
          res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());
        }
        sendError(
          res,
          result.reason || 'Too many requests. Please try again later.',
          429
        );
        return;
      }

      // Set rate limit headers for allowed requests
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString());

      next();
    } catch (error) {
      console.error('[THROTTLING] Error in throttle middleware:', error);
      // On error, allow request (fail open)
      next();
    }
  };
}

/**
 * Middleware to apply throttling using rule from database
 */
export function throttleRuleMiddleware(ruleId: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await checkThrottleRule(req, ruleId);

      if (!result.allowed) {
        // Get rule for metadata
        const rule = await ThrottleRule.findById(ruleId);

        res.setHeader('X-RateLimit-Limit', rule?.maxRequests.toString() || '0');
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString());
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }

        await logAudit({
          req,
          action: 'THROTTLE_RULE_LIMIT_EXCEEDED',
          entityType: 'ThrottleRule',
          entityId: ruleId,
          description: `Throttle rule limit exceeded: ${rule?.name || ruleId}`,
          metadata: {
            ruleId,
            ruleName: rule?.name,
            retryAfter: result.retryAfter,
          },
        }).catch((err) => {
          console.error('[THROTTLING] Failed to log audit:', err);
        });

        // Set retry headers
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }
        if (result.resetTime) {
          res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());
        }
        sendError(
          res,
          result.reason || 'Too many requests. Please try again later.',
          429
        );
        return;
      }

      // Set headers
      const rule = await ThrottleRule.findById(ruleId);
      res.setHeader('X-RateLimit-Limit', rule?.maxRequests.toString() || '0');
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString());

      next();
    } catch (error) {
      console.error('[THROTTLING] Error in throttle rule middleware:', error);
      next();
    }
  };
}

/**
 * Middleware to apply throttling based on matching rules
 * Checks all active rules and applies the most restrictive one
 */
export function throttleAutoMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Find matching active rules
      const rules = await ThrottleRule.find({
        active: true,
      })
        .sort({ priority: -1 }) // Higher priority first
        .lean();

      // Check each rule
      for (const rule of rules) {
        // Check if rule applies to this endpoint
        if (rule.endpointPattern) {
          const regex = new RegExp(rule.endpointPattern);
          if (!regex.test(`${req.method} ${req.path}`)) {
            continue;
          }
        }

        // Check user role
        if (rule.userRoles && rule.userRoles.length > 0) {
          if (!req.user || !rule.userRoles.includes(req.user.role)) {
            continue;
          }
        }

        // Check IP whitelist
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          (req.headers['x-real-ip'] as string) ||
          req.ip ||
          req.socket.remoteAddress ||
          'unknown';

        if (rule.ipWhitelist && rule.ipWhitelist.length > 0) {
          if (rule.ipWhitelist.includes(ip)) {
            continue; // Skip throttling for whitelisted IPs
          }
        }

        // Check IP blacklist
        if (rule.ipBlacklist && rule.ipBlacklist.includes(ip)) {
          // Always throttle blacklisted IPs
          const config: ThrottleConfig = {
            strategy: rule.strategy,
            scope: rule.scope,
            maxRequests: 0, // Block completely
            windowMs: rule.windowMs,
            blockDuration: rule.blockDuration,
          };
          const result = await checkThrottle(req, config, rule._id.toString());
          if (!result.allowed) {
            res.setHeader('X-RateLimit-Limit', '0');
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('Retry-After', result.retryAfter?.toString() || '3600');
            sendError(res, 'Access denied', 403);
            return;
          }
        }

        // Apply rule
        const config: ThrottleConfig = {
          strategy: rule.strategy,
          scope: rule.scope,
          maxRequests: rule.maxRequests,
          windowMs: rule.windowMs,
          bucketSize: rule.bucketSize || undefined,
          refillRate: rule.refillRate || undefined,
          blockDuration: rule.blockDuration || undefined,
        };

        const result = await checkThrottle(req, config, rule._id.toString());

        if (!result.allowed) {
          res.setHeader('X-RateLimit-Limit', rule.maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
          res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString());
          if (result.retryAfter) {
            res.setHeader('Retry-After', result.retryAfter.toString());
          }

          await logAudit({
            req,
            action: 'THROTTLE_AUTO_LIMIT_EXCEEDED',
            entityType: 'ThrottleRule',
            entityId: rule._id.toString(),
            description: `Auto throttle limit exceeded: ${rule.name}`,
            metadata: {
              ruleId: rule._id.toString(),
              ruleName: rule.name,
              retryAfter: result.retryAfter,
            },
          }).catch((err) => {
            console.error('[THROTTLING] Failed to log audit:', err);
          });

          // Set retry headers
          if (result.retryAfter) {
            res.setHeader('Retry-After', result.retryAfter.toString());
          }
          if (result.resetTime) {
            res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());
          }
          sendError(
            res,
            result.reason || 'Too many requests. Please try again later.',
            429
          );
          return;
        }

        // Set headers from first matching rule
        res.setHeader('X-RateLimit-Limit', rule.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString());
      }

      next();
    } catch (error) {
      console.error('[THROTTLING] Error in auto throttle middleware:', error);
      next();
    }
  };
}

