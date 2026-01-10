import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

interface AccessTokenPayload {
  id: string;
  userId: string; // Alias for id (for consistency)
  email: string;
  role: string;
  storeId?: string; // Store ID (tenant) - optional for admin users
}

interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
}

/**
 * Sign an access token for a user
 */
export const signAccessToken = (user: { _id?: string; id?: string; email: string; role: string; storeId?: string }): string => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET or JWT_SECRET is not defined');
  }

  const userId = user._id?.toString() || user.id || '';
  if (!userId) {
    throw new Error('User ID is required for token generation');
  }

  const payload: AccessTokenPayload = {
    id: userId,
    userId: userId, // Alias for consistency
    email: user.email,
    role: user.role,
    storeId: user.storeId, // Store ID (tenant) - optional
  };

  const options: SignOptions = {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };

  return jwt.sign(payload, secret, options);
};

/**
 * Sign a refresh token for a user
 */
export const signRefreshToken = (userId: string, tokenId: string): string => {
  // Backward-compatible fallbacks:
  // - older deployments/docs may use REFRESH_TOKEN_SECRET
  const secret = process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET (or REFRESH_TOKEN_SECRET) is not defined');
  }

  const payload: RefreshTokenPayload = {
    userId,
    tokenId,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  };

  return jwt.sign(payload, secret, options);
};

/**
 * Verify an access token
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET or JWT_SECRET is not defined');
  }

  try {
    const decoded = jwt.verify(token, secret) as AccessTokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

/**
 * Verify a refresh token
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  // Backward-compatible fallbacks:
  // - older deployments/docs may use REFRESH_TOKEN_SECRET
  const secret = process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET (or REFRESH_TOKEN_SECRET) is not defined');
  }

  try {
    const decoded = jwt.verify(token, secret) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Generate a new token ID (UUID)
 */
export const generateTokenId = (): string => {
  return randomUUID();
};

