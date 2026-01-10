import crypto from 'crypto';

/**
 * PCI Compliance Service
 * 
 * PURPOSE:
 * - Mask and sanitize PCI-sensitive data (card numbers, CVV, etc.)
 * - Validate that no cardholder data is stored
 * - Provide utilities for PCI DSS compliance
 * 
 * PCI DSS Requirements:
 * - Never store full card numbers, CVV, or track data
 * - Mask card numbers when displaying (show only last 4 digits)
 * - Encrypt sensitive payment metadata
 * - Log access to payment data
 */

// PCI-sensitive field patterns
const PCI_SENSITIVE_PATTERNS = {
  // Card numbers (13-19 digits, may have spaces/dashes)
  cardNumber: /\b(?:\d[ -]*?){13,19}\b/g,
  // CVV (3-4 digits)
  cvv: /\b\d{3,4}\b/g,
  // Track data (magnetic stripe data)
  trackData: /%?[A-Z0-9=]{1,76}\?/gi,
  // PAN (Primary Account Number) - same as card number
  pan: /\b(?:\d[ -]*?){13,19}\b/g,
  // Expiry date (MM/YY or MM/YYYY)
  expiryDate: /\b(0[1-9]|1[0-2])\/?([0-9]{2,4})\b/g,
};

// PCI-sensitive field names (case-insensitive)
const PCI_SENSITIVE_KEYS = new Set([
  'cardnumber',
  'card_number',
  'cardNumber',
  'pan',
  'primaryaccountnumber',
  'primary_account_number',
  'cvv',
  'cvv2',
  'cvc',
  'cvc2',
  'cvn',
  'cardverificationvalue',
  'card_verification_value',
  'expiry',
  'expirydate',
  'expiry_date',
  'expiration',
  'expirationdate',
  'expiration_date',
  'trackdata',
  'track_data',
  'magneticstripe',
  'magnetic_stripe',
  'fulltrackdata',
  'full_track_data',
  'sensitivedauthenticationdata',
  'sensitive_authentication_data',
  'sad',
]);

/**
 * Check if a string contains PCI-sensitive data
 */
export function containsPCIData(value: string): boolean {
  if (typeof value !== 'string') return false;

  // Check against patterns
  for (const pattern of Object.values(PCI_SENSITIVE_PATTERNS)) {
    if (pattern.test(value)) {
      return true;
    }
  }

  return false;
}

/**
 * Mask a card number (show only last 4 digits)
 * Example: 4111111111111111 -> **** **** **** 1111
 */
export function maskCardNumber(cardNumber: string | number | null | undefined): string {
  if (!cardNumber) return '[MASKED]';

  const str = String(cardNumber).replace(/[^0-9]/g, ''); // Remove non-digits

  if (str.length < 4) return '[MASKED]';

  const last4 = str.slice(-4);
  const masked = '*'.repeat(Math.max(0, str.length - 4));

  // Format as XXXX XXXX XXXX XXXX if 16 digits
  if (str.length === 16) {
    return `**** **** **** ${last4}`;
  }

  return `${masked}${last4}`;
}

/**
 * Mask CVV (always fully mask)
 */
export function maskCVV(cvv: string | number | null | undefined): string {
  if (!cvv) return '[MASKED]';
  return '***';
}

/**
 * Mask expiry date (show only month/year format, no day)
 */
export function maskExpiryDate(expiry: string | null | undefined): string {
  if (!expiry) return '[MASKED]';
  // If it's in MM/YY or MM/YYYY format, return as-is (already safe)
  // Otherwise mask
  if (/^(0[1-9]|1[0-2])\/?([0-9]{2,4})$/.test(expiry)) {
    return expiry;
  }
  return '[MASKED]';
}

/**
 * Sanitize an object by masking PCI-sensitive fields
 */
export function sanitizePCIData(data: any): any {
  if (data === null || data === undefined) return data;

  // Primitive types
  if (typeof data === 'string') {
    // Check if string contains card number pattern
    if (containsPCIData(data)) {
      // Try to extract and mask card number
      const cardMatch = data.match(/\b(?:\d[ -]*?){13,19}\b/);
      if (cardMatch) {
        return data.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => maskCardNumber(match));
      }
      return '[PCI_DATA_MASKED]';
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (data instanceof Date) {
    return data;
  }

  // Arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizePCIData(item));
  }

  // Objects
  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();

      // Mask known PCI-sensitive keys
      if (PCI_SENSITIVE_KEYS.has(keyLower)) {
        if (keyLower.includes('cvv') || keyLower.includes('cvc') || keyLower.includes('cvn')) {
          sanitized[key] = maskCVV(value as string | number | null | undefined);
        } else if (keyLower.includes('expiry') || keyLower.includes('expiration')) {
          sanitized[key] = maskExpiryDate(value as string | null | undefined);
        } else if (keyLower.includes('card') || keyLower.includes('pan')) {
          sanitized[key] = maskCardNumber(value as string | number | null | undefined);
        } else {
          sanitized[key] = '[PCI_DATA_MASKED]';
        }
      } else if (typeof value === 'string' && containsPCIData(value)) {
        // String contains PCI data pattern
        sanitized[key] = '[PCI_DATA_MASKED]';
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizePCIData(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Validate that an object does not contain PCI-sensitive data
 * Throws error if PCI data is detected
 */
export function validateNoPCIData(data: any, context?: string): void {
  const sanitized = sanitizePCIData(data);
  const original = JSON.stringify(data);
  const sanitizedStr = JSON.stringify(sanitized);

  // If sanitization changed the data, it means PCI data was present
  if (original !== sanitizedStr) {
    const error = new Error(
      `PCI-sensitive data detected${context ? ` in ${context}` : ''}. Cardholder data must not be stored.`
    );
    (error as any).isPCIComplianceError = true;
    throw error;
  }
}

/**
 * Encrypt sensitive payment metadata
 * Uses AES-256-GCM for authenticated encryption
 */
export function encryptPaymentMetadata(data: string, key?: string): string {
  const encryptionKey = key || process.env.PCI_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';

  if (!encryptionKey || encryptionKey === 'default-key-change-in-production') {
    console.warn('[PCI] Using default encryption key. Set PCI_ENCRYPTION_KEY in production!');
  }

  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, crypto.scryptSync(encryptionKey, 'salt', 32), iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return IV + authTag + encrypted data (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive payment metadata
 */
export function decryptPaymentMetadata(encryptedData: string, key?: string): string {
  const encryptionKey = key || process.env.PCI_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';

  const algorithm = 'aes-256-gcm';
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(algorithm, crypto.scryptSync(encryptionKey, 'salt', 32), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a token for payment (tokenization)
 * This replaces card data with a secure token
 */
export function generatePaymentToken(metadata: Record<string, any>): string {
  const data = JSON.stringify(metadata);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return `pay_token_${hash.substring(0, 32)}`;
}

/**
 * Check if a request body/query/params contains PCI data
 */
export function checkRequestForPCIData(req: {
  body?: any;
  query?: any;
  params?: any;
}): { hasPCIData: boolean; fields: string[] } {
  const fields: string[] = [];
  let hasPCIData = false;

  const checkObject = (obj: any, prefix = ''): void => {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const keyLower = key.toLowerCase();

      if (PCI_SENSITIVE_KEYS.has(keyLower)) {
        hasPCIData = true;
        fields.push(fullKey);
      } else if (typeof value === 'string' && containsPCIData(value)) {
        hasPCIData = true;
        fields.push(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        checkObject(value, fullKey);
      }
    }
  };

  if (req.body) checkObject(req.body, 'body');
  if (req.query) checkObject(req.query, 'query');
  if (req.params) checkObject(req.params, 'params');

  return { hasPCIData, fields };
}

