import { Request } from 'express';
import mongoose from 'mongoose';
import { ThrottleRule, IThrottleRule } from '../models/ThrottleRule';
import { ThrottleLog, IThrottleLog } from '../models/ThrottleLog';

/**
 * Request Throttling Service
 * 
 * PURPOSE:
 * - Implement multiple throttling strategies
 * - Track request rates per user/IP/endpoint
 * - Enforce throttling rules
 * - Log throttling events
 * 
 * STRATEGIES:
 * - Sliding Window: Fixed window with sliding boundaries
 * - Token Bucket: Allow bursts up to bucket size
 * - Leaky Bucket: Smooth rate limiting
 * - Fixed Window: Simple time-based window
 */

export type ThrottleStrategy = 'sliding-window' | 'token-bucket' | 'leaky-bucket' | 'fixed-window';
export type ThrottleScope = 'global' | 'user' | 'ip' | 'endpoint' | 'user-endpoint' | 'ip-endpoint';

export interface ThrottleConfig {
  strategy: ThrottleStrategy;
  scope: ThrottleScope;
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  bucketSize?: number; // For token bucket
  refillRate?: number; // For token bucket/leaky bucket
  blockDuration?: number; // Duration to block after limit exceeded (ms)
}

export interface ThrottleResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // Seconds to wait before retry
  reason?: string;
}

export interface ThrottleKey {
  scope: ThrottleScope;
  identifier: string; // user ID, IP, endpoint, etc.
  ruleId?: string;
}

// In-memory cache for throttling state (can be replaced with Redis in production)
const throttleCache = new Map<string, {
  count: number;
  resetTime: number;
  tokens?: number; // For token bucket
  lastRefill?: number; // For token bucket
  blockedUntil?: number; // Block expiration time
}>();

/**
 * Generate throttle key
 */
function generateThrottleKey(key: ThrottleKey): string {
  const parts = [key.scope, key.identifier];
  if (key.ruleId) {
    parts.push(key.ruleId);
  }
  return parts.join(':');
}

/**
 * Get identifier from request based on scope
 */
export function getThrottleIdentifier(
  req: Request,
  scope: ThrottleScope
): string {
  switch (scope) {
    case 'user':
      return req.user?.id || 'anonymous';
    case 'ip':
      return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown'
      );
    case 'endpoint':
      return `${req.method}:${req.path}`;
    case 'user-endpoint':
      return `${req.user?.id || 'anonymous'}:${req.method}:${req.path}`;
    case 'ip-endpoint':
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown';
      return `${ip}:${req.method}:${req.path}`;
    case 'global':
    default:
      return 'global';
  }
}

/**
 * Sliding Window Strategy
 * Tracks requests in a sliding time window
 */
function slidingWindowStrategy(
  key: string,
  maxRequests: number,
  windowMs: number
): ThrottleResult {
  const now = Date.now();
  const cacheKey = `sliding:${key}`;
  const state = throttleCache.get(cacheKey);

  if (!state) {
    throttleCache.set(cacheKey, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: new Date(now + windowMs),
    };
  }

  // Check if window has expired
  if (now >= state.resetTime) {
    throttleCache.set(cacheKey, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: new Date(now + windowMs),
    };
  }

  // Check if limit exceeded
  if (state.count >= maxRequests) {
    const retryAfter = Math.ceil((state.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(state.resetTime),
      retryAfter,
      reason: 'Rate limit exceeded',
    };
  }

  // Increment count
  state.count++;
  throttleCache.set(cacheKey, state);

  return {
    allowed: true,
    remaining: maxRequests - state.count,
    resetTime: new Date(state.resetTime),
  };
}

/**
 * Token Bucket Strategy
 * Allows bursts up to bucket size, refills at constant rate
 */
function tokenBucketStrategy(
  key: string,
  maxRequests: number,
  windowMs: number,
  bucketSize?: number,
  refillRate?: number
): ThrottleResult {
  const now = Date.now();
  const cacheKey = `token:${key}`;
  const state = throttleCache.get(cacheKey);

  const bucket = bucketSize || maxRequests;
  const refill = refillRate || (maxRequests / (windowMs / 1000)); // Requests per second

  if (!state || !state.tokens) {
    throttleCache.set(cacheKey, {
      count: 0,
      resetTime: now + windowMs,
      tokens: bucket,
      lastRefill: now,
    });
    return {
      allowed: true,
      remaining: bucket - 1,
      resetTime: new Date(now + windowMs),
    };
  }

  // Refill tokens based on time passed
  const timePassed = (now - (state.lastRefill || now)) / 1000; // seconds
  const tokensToAdd = timePassed * refill;
  const newTokens = Math.min(bucket, (state.tokens || 0) + tokensToAdd);

  if (newTokens < 1) {
    const timeUntilNextToken = (1 - newTokens) / refill;
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(now + windowMs),
      retryAfter: Math.ceil(timeUntilNextToken),
      reason: 'Token bucket empty',
    };
  }

  // Consume token
  const updatedTokens = newTokens - 1;
  throttleCache.set(cacheKey, {
    count: state.count + 1,
    resetTime: now + windowMs,
    tokens: updatedTokens,
    lastRefill: now,
  });

  return {
    allowed: true,
    remaining: Math.floor(updatedTokens),
    resetTime: new Date(now + windowMs),
  };
}

/**
 * Leaky Bucket Strategy
 * Smooth rate limiting, no bursts
 */
function leakyBucketStrategy(
  key: string,
  maxRequests: number,
  windowMs: number,
  refillRate?: number
): ThrottleResult {
  const now = Date.now();
  const cacheKey = `leaky:${key}`;
  const state = throttleCache.get(cacheKey);

  const refill = refillRate || (maxRequests / (windowMs / 1000)); // Requests per second

  if (!state || !state.tokens) {
    throttleCache.set(cacheKey, {
      count: 0,
      resetTime: now + windowMs,
      tokens: 1, // Start with 1 token
      lastRefill: now,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: new Date(now + windowMs),
    };
  }

  // Refill tokens
  const timePassed = (now - (state.lastRefill || now)) / 1000;
  const tokensToAdd = timePassed * refill;
  const newTokens = Math.min(maxRequests, (state.tokens || 0) + tokensToAdd);

  if (newTokens < 1) {
    const timeUntilNextToken = (1 - newTokens) / refill;
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(now + windowMs),
      retryAfter: Math.ceil(timeUntilNextToken),
      reason: 'Leaky bucket empty',
    };
  }

  // Consume token
  const updatedTokens = newTokens - 1;
  throttleCache.set(cacheKey, {
    count: state.count + 1,
    resetTime: now + windowMs,
    tokens: updatedTokens,
    lastRefill: now,
  });

  return {
    allowed: true,
    remaining: Math.floor(updatedTokens),
    resetTime: new Date(now + windowMs),
  };
}

/**
 * Fixed Window Strategy
 * Simple time-based window (resets at window boundary)
 */
function fixedWindowStrategy(
  key: string,
  maxRequests: number,
  windowMs: number
): ThrottleResult {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const cacheKey = `fixed:${key}:${windowStart}`;
  const state = throttleCache.get(cacheKey);

  if (!state) {
    throttleCache.set(cacheKey, {
      count: 1,
      resetTime: windowStart + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: new Date(windowStart + windowMs),
    };
  }

  if (state.count >= maxRequests) {
    const retryAfter = Math.ceil((state.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(state.resetTime),
      retryAfter,
      reason: 'Rate limit exceeded',
    };
  }

  state.count++;
  throttleCache.set(cacheKey, state);

  return {
    allowed: true,
    remaining: maxRequests - state.count,
    resetTime: new Date(state.resetTime),
  };
}

/**
 * Check if request should be throttled
 */
export async function checkThrottle(
  req: Request,
  config: ThrottleConfig,
  ruleId?: string
): Promise<ThrottleResult> {
  const identifier = getThrottleIdentifier(req, config.scope);
  const throttleKey: ThrottleKey = {
    scope: config.scope,
    identifier,
    ruleId,
  };
  const key = generateThrottleKey(throttleKey);

  let result: ThrottleResult;

  // Check if blocked
  const blockKey = `block:${key}`;
  const blockState = throttleCache.get(blockKey);
  if (blockState?.blockedUntil && Date.now() < blockState.blockedUntil) {
    const retryAfter = Math.ceil((blockState.blockedUntil - Date.now()) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(blockState.blockedUntil),
      retryAfter,
      reason: 'Temporarily blocked',
    };
  }

  // Apply strategy
  switch (config.strategy) {
    case 'token-bucket':
      result = tokenBucketStrategy(
        key,
        config.maxRequests,
        config.windowMs,
        config.bucketSize,
        config.refillRate
      );
      break;
    case 'leaky-bucket':
      result = leakyBucketStrategy(
        key,
        config.maxRequests,
        config.windowMs,
        config.refillRate
      );
      break;
    case 'fixed-window':
      result = fixedWindowStrategy(key, config.maxRequests, config.windowMs);
      break;
    case 'sliding-window':
    default:
      result = slidingWindowStrategy(key, config.maxRequests, config.windowMs);
      break;
  }

  // If limit exceeded and block duration set, block the key
  if (!result.allowed && config.blockDuration) {
    const blockUntil = Date.now() + config.blockDuration;
    throttleCache.set(blockKey, {
      count: 0,
      resetTime: blockUntil,
      blockedUntil: blockUntil,
    });
  }

  // Log throttling event
  await logThrottleEvent(req, throttleKey, result, ruleId);

  return result;
}

/**
 * Check throttling using rule from database
 */
export async function checkThrottleRule(
  req: Request,
  ruleId: string
): Promise<ThrottleResult> {
  const rule = await ThrottleRule.findOne({
    _id: ruleId,
    active: true,
  });

  if (!rule) {
    // No rule found, allow request
    return {
      allowed: true,
      remaining: Infinity,
      resetTime: new Date(Date.now() + 60000),
    };
  }

  const config: ThrottleConfig = {
    strategy: rule.strategy,
    scope: rule.scope,
    maxRequests: rule.maxRequests,
    windowMs: rule.windowMs,
    bucketSize: rule.bucketSize,
    refillRate: rule.refillRate,
    blockDuration: rule.blockDuration,
  };

  return checkThrottle(req, config, ruleId);
}

/**
 * Log throttling event
 */
async function logThrottleEvent(
  req: Request,
  key: ThrottleKey,
  result: ThrottleResult,
  ruleId?: string
): Promise<void> {
  try {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    await ThrottleLog.create({
      ruleId: ruleId ? new mongoose.Types.ObjectId(ruleId) : null,
      scope: key.scope,
      identifier: key.identifier,
      allowed: result.allowed,
      remaining: result.remaining,
      ipAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      endpoint: `${req.method} ${req.path}`,
      retryAfter: result.retryAfter,
      reason: result.reason,
    });
  } catch (error) {
    // Don't throw - logging failure shouldn't break throttling
    console.error('[THROTTLING] Failed to log event:', error);
  }
}

/**
 * Get throttling statistics
 */
export async function getThrottleStats(
  ruleId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  byScope: Record<string, number>;
  byEndpoint: Record<string, number>;
}> {
  const filter: any = {};
  if (ruleId) {
    filter.ruleId = new mongoose.Types.ObjectId(ruleId);
  }
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const logs = await ThrottleLog.find(filter).lean();

  const stats = {
    total: logs.length,
    allowed: logs.filter((log) => log.allowed).length,
    blocked: logs.filter((log) => !log.allowed).length,
    blockRate: 0,
    byScope: {} as Record<string, number>,
    byEndpoint: {} as Record<string, number>,
  };

  stats.blockRate = stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0;

  logs.forEach((log) => {
    stats.byScope[log.scope] = (stats.byScope[log.scope] || 0) + 1;
    stats.byEndpoint[log.endpoint] = (stats.byEndpoint[log.endpoint] || 0) + 1;
  });

  return stats;
}

/**
 * Clear throttle cache (for testing or manual reset)
 */
export function clearThrottleCache(key?: string): void {
  if (key) {
    throttleCache.delete(key);
  } else {
    throttleCache.clear();
  }
}

/**
 * Clean up expired cache entries
 */
export function cleanupThrottleCache(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, state] of throttleCache.entries()) {
    if (state.resetTime < now && (!state.blockedUntil || state.blockedUntil < now)) {
      throttleCache.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupThrottleCache();
  }, 5 * 60 * 1000);
}

