import { Response, Request } from 'express';
import crypto from 'crypto';

/**
 * Generate a secure random CSRF token
 * @returns 32-byte hex string (64 characters)
 */
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Set CSRF token as a readable cookie (NOT HttpOnly)
 * This allows JavaScript to read it for the Double Submit Cookie pattern
 */
export const setCsrfCookie = (res: Response, token: string): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('csrf_token', token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: isProduction, // HTTPS only in production (required for sameSite: 'none')
    sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict', // 'none' for cross-origin in production
    path: '/', // Available site-wide
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (aligned with refresh token)
  });
};

/**
 * Verify CSRF token from request
 * Compares token from cookie with token from header
 * @returns true if valid, false otherwise
 */
export const verifyCsrfToken = (req: Request): boolean => {
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'] as string;

  // Both must be present
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Must match exactly (constant-time comparison)
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken, 'utf8'),
    Buffer.from(headerToken, 'utf8')
  );
};

/**
 * Clear CSRF token cookie
 */
export const clearCsrfCookie = (res: Response): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('csrf_token', {
    httpOnly: false,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
    path: '/',
  });
};

