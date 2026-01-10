import { randomBytes, createHash } from 'crypto';

/**
 * Generate a secure random password reset token
 * Returns a URL-safe base64 string (32+ characters)
 */
export const generateResetToken = (): string => {
  // Generate 32 random bytes (256 bits)
  const randomBytesBuffer = randomBytes(32);
  // Convert to base64url (URL-safe)
  return randomBytesBuffer.toString('base64url');
};

/**
 * Hash a reset token using SHA-256
 * Never store raw tokens in the database
 */
export const hashResetToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};

