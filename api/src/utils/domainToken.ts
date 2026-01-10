import crypto from 'crypto';

/**
 * Generate a unique DNS verification token
 * @returns Base64 encoded random token
 */
export const generateDomainToken = (): string => {
  // Generate 32 random bytes and encode as base64
  const token = crypto.randomBytes(32).toString('base64');
  // Remove any characters that might cause issues in DNS records
  return token.replace(/[+/=]/g, '').substring(0, 32);
};

/**
 * Validate domain format
 * @param domain Domain string to validate
 * @returns boolean
 */
export const validateDomain = (domain: string): boolean => {
  // Remove protocol if present
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // Basic domain validation regex
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  
  return domainRegex.test(cleanDomain);
};

/**
 * Clean domain string (remove protocol, trailing slashes, etc.)
 * @param domain Raw domain input
 * @returns Cleaned domain string
 */
export const cleanDomain = (domain: string): string => {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/\/$/, '') // Remove trailing slash
    .replace(/^www\./, ''); // Remove www prefix
};

