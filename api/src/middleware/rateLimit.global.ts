import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Global rate limiter for all requests
 * Prevents abuse across the entire API
 */
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
  max: process.env.NODE_ENV === "production" 
    ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10) 
    : 10000, // Dev: 10000 requests, Prod: 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use IP address as key
  keyGenerator: (req: Request) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

