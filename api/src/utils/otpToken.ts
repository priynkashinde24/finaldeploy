import { randomInt } from 'crypto';
import { createHash } from 'crypto';

/**
 * Generate a 6-digit OTP
 */
export const generateOTP = (): string => {
  // Generate random 6-digit number (100000 to 999999)
  const otp = randomInt(100000, 999999);
  return otp.toString();
};

/**
 * Hash an OTP using SHA-256
 * Never store raw OTPs in the database
 */
export const hashOTP = (otp: string): string => {
  return createHash('sha256').update(otp).digest('hex');
};

/**
 * Normalize phone number (remove spaces, dashes, etc.)
 * Format: +1234567890 or 1234567890
 */
export const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // If doesn't start with +, assume it's a local number
  // You may want to add country code detection here
  if (!normalized.startsWith('+')) {
    // Default to +1 for US/Canada (adjust as needed)
    normalized = '+1' + normalized;
  }
  
  return normalized;
};

/**
 * Validate phone number format
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const normalized = normalizePhoneNumber(phone);
  // Basic validation: should have + and at least 10 digits
  return /^\+[1-9]\d{9,14}$/.test(normalized);
};

