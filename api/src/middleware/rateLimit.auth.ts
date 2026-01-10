import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response } from 'express';

/**
 * General auth rate limiter (for future use)
 * Dev: 500 requests per 15 minutes per IP
 * Prod: 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 500,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Login rate limiter
 * Dev: 500 attempts per 15 minutes per IP
 * Prod: 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 5 : 500, // Dev-friendly limit
  message: {
    success: false,
    message: 'Too many login attempts. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
  skipSuccessfulRequests: false, // Count all requests, including successful ones
  handler: async (req: Request, res: Response) => {
    // Audit log: Login rate limit exceeded
    const { logAudit } = await import('../utils/auditLogger');
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    await logAudit({
      actorId: 'unknown',
      actorRole: 'reseller', // Default
      action: 'LOGIN_RATE_LIMIT_EXCEEDED',
      entityType: 'User',
      description: `Login rate limit exceeded from IP: ${ipAddress}`,
      req,
      metadata: {
        ipAddress,
        email: (req.body as any)?.email || 'unknown',
      },
    });

    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Try again later.',
    });
  },
});

/**
 * Login slow-down middleware
 * Adds delay after multiple requests to make brute-force impractical
 */
export const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Start delaying after 2 requests
  // New v2 behavior: delayMs is now a function
  delayMs: () => 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  validate: { delayMs: false }, // Disable validation warning
});

/**
 * Forgot password rate limiter
 * Dev: 100 requests per hour per IP
 * Prod: 3 requests per hour per IP
 */
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === "production" ? 3 : 100, // Dev-friendly limit
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
  handler: async (req: Request, res: Response) => {
    // Audit log: Password reset rate limit exceeded
    const { logAudit } = await import('../utils/auditLogger');
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    await logAudit({
      actorId: 'unknown',
      actorRole: 'reseller', // Default
      action: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      entityType: 'User',
      description: `Password reset rate limit exceeded from IP: ${ipAddress}`,
      req,
      metadata: {
        ipAddress,
        email: (req.body as any)?.email || 'unknown',
      },
    });

    res.status(429).json({
      success: false,
      message: 'Too many password reset requests. Please try again later.',
    });
  },
});

/**
 * Reset password rate limiter
 * Dev: 100 attempts per hour per IP
 * Prod: 3 attempts per hour per IP
 */
export const resetPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === "production" ? 3 : 100, // Dev-friendly limit
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
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

/**
 * Invite accept rate limiter
 * 5 attempts per hour per IP
 */
export const inviteAcceptRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: {
    success: false,
    message: 'Too many invite acceptance attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
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

/**
 * OTP send rate limiter
 * Dev: 100 requests per 15 minutes per phone number
 * Prod: 3 requests per 15 minutes per phone number
 */
export const otpSendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 3 : 100, // Dev-friendly limit
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use phone number from body if available, otherwise use IP
    const phone = (req.body as any)?.phone;
    if (phone) {
      return `otp:${phone}`;
    }
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
  handler: async (req: Request, res: Response) => {
    const { logAudit } = await import('../utils/auditLogger');
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    await logAudit({
      actorId: 'unknown',
      actorRole: 'reseller',
      action: 'OTP_SEND_RATE_LIMIT_EXCEEDED',
      entityType: 'User',
      description: `OTP send rate limit exceeded from IP: ${ipAddress}`,
      req,
      metadata: {
        ipAddress,
        phone: (req.body as any)?.phone || 'unknown',
      },
    });

    res.status(429).json({
      success: false,
      message: 'Too many OTP requests. Please try again later.',
    });
  },
});

/**
 * OTP verify rate limiter
 * Dev: 500 attempts per 15 minutes per phone number
 * Prod: 5 attempts per 15 minutes per phone number
 */
export const otpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 5 : 500, // Dev-friendly limit
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const phone = (req.body as any)?.phone;
    if (phone) {
      return `otp-verify:${phone}`;
    }
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

/**
 * Magic link send rate limiter
 * Dev: 100 requests per 15 minutes per email
 * Prod: 3 requests per 15 minutes per email
 */
export const magicLinkRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 3 : 100, // Dev-friendly limit
  message: {
    success: false,
    message: 'Too many magic link requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use email from body if available, otherwise use IP
    const email = (req.body as any)?.email;
    if (email) {
      return `magic-link:${email.toLowerCase()}`;
    }
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
  handler: async (req: Request, res: Response) => {
    // Audit log: Magic link rate limit exceeded
    const { logAudit } = await import('../utils/auditLogger');
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    await logAudit({
      actorId: 'unknown',
      actorRole: 'reseller', // Default
      action: 'MAGIC_LINK_RATE_LIMIT_EXCEEDED',
      entityType: 'User',
      description: `Magic link rate limit exceeded from IP: ${ipAddress}`,
      req,
      metadata: {
        ipAddress,
        email: (req.body as any)?.email || 'unknown',
      },
    });

    res.status(429).json({
      success: false,
      message: 'Too many magic link requests. Please try again later.',
    });
  },
});

