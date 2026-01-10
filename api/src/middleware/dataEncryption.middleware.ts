import { Request, Response, NextFunction } from 'express';
import { encryptField, decryptField } from '../services/dataEncryption.service';
import { isEncrypted } from '../utils/encryptionHelpers';

/**
 * Data Encryption Middleware
 * 
 * PURPOSE:
 * - Automatically encrypt/decrypt sensitive fields in requests/responses
 * - Protect sensitive data in transit
 * - Support field-level encryption
 */

export interface EncryptionConfig {
  encryptRequestFields?: string[]; // Fields to encrypt in request body
  decryptResponseFields?: string[]; // Fields to decrypt in response
  encryptQueryParams?: string[]; // Query params to encrypt
}

/**
 * Middleware to encrypt sensitive fields in request body
 */
export function encryptRequestMiddleware(config: EncryptionConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (config.encryptRequestFields && req.body) {
        for (const field of config.encryptRequestFields) {
          if (req.body[field] !== undefined && req.body[field] !== null) {
            if (!isEncrypted(req.body[field])) {
              req.body[field] = encryptField(req.body[field]);
            }
          }
        }
      }

      if (config.encryptQueryParams && req.query) {
        for (const param of config.encryptQueryParams) {
          if (req.query[param] !== undefined && req.query[param] !== null) {
            const value = String(req.query[param]);
            if (!isEncrypted(value)) {
              req.query[param] = encryptField(value) as any;
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('[ENCRYPTION] Request encryption error:', error);
      next(error);
    }
  };
}

/**
 * Middleware to decrypt sensitive fields in response
 */
export function decryptResponseMiddleware(config: EncryptionConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      try {
        if (config.decryptResponseFields && data && typeof data === 'object') {
          const decryptObject = (obj: any): any => {
            if (Array.isArray(obj)) {
              return obj.map(decryptObject);
            } else if (obj && typeof obj === 'object') {
              const decrypted: any = {};
              for (const [key, value] of Object.entries(obj)) {
                if (config.decryptResponseFields!.includes(key) && isEncrypted(value)) {
                  try {
                    decrypted[key] = decryptField(value as string);
                  } catch (error) {
                    console.error(`[ENCRYPTION] Failed to decrypt field ${key}:`, error);
                    decrypted[key] = value; // Keep encrypted on error
                  }
                } else if (value && typeof value === 'object') {
                  decrypted[key] = decryptObject(value);
                } else {
                  decrypted[key] = value;
                }
              }
              return decrypted;
            }
            return obj;
          };

          data = decryptObject(data);
        }
      } catch (error) {
        console.error('[ENCRYPTION] Response decryption error:', error);
        // Continue with original data on error
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Combined middleware for encrypting requests and decrypting responses
 */
export function dataEncryptionMiddleware(config: EncryptionConfig) {
  return [encryptRequestMiddleware(config), decryptResponseMiddleware(config)];
}

