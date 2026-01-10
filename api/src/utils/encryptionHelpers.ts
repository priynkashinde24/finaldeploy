import { encryptData, decryptData, EncryptedData, EncryptionAlgorithm } from '../services/dataEncryption.service';

/**
 * Encryption Helpers
 * 
 * PURPOSE:
 * - Convenience functions for common encryption tasks
 * - Type-safe encryption/decryption
 * - Helper functions for specific data types
 */

/**
 * Encrypt a string value
 */
export function encryptString(value: string, algorithm?: EncryptionAlgorithm): string {
  const encrypted = encryptData(value, { algorithm });
  return JSON.stringify(encrypted);
}

/**
 * Decrypt a string value
 */
export function decryptString(encryptedValue: string): string {
  const encrypted: EncryptedData = JSON.parse(encryptedValue);
  const decrypted = decryptData(encrypted);
  return Buffer.isBuffer(decrypted) ? decrypted.toString('utf8') : String(decrypted);
}

/**
 * Encrypt a number value
 */
export function encryptNumber(value: number): string {
  return encryptString(String(value));
}

/**
 * Decrypt a number value
 */
export function decryptNumber(encryptedValue: string): number {
  const decrypted = decryptString(encryptedValue);
  return Number(decrypted);
}

/**
 * Encrypt a boolean value
 */
export function encryptBoolean(value: boolean): string {
  return encryptString(String(value));
}

/**
 * Decrypt a boolean value
 */
export function decryptBoolean(encryptedValue: string): boolean {
  const decrypted = decryptString(encryptedValue);
  return decrypted === 'true';
}

/**
 * Encrypt an object
 */
export function encryptObject<T extends Record<string, any>>(obj: T): string {
  const encrypted = encryptData(obj);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt an object
 */
export function decryptObject<T = any>(encryptedValue: string): T {
  const encrypted: EncryptedData = JSON.parse(encryptedValue);
  const decrypted = decryptData(encrypted);
  const jsonString = Buffer.isBuffer(decrypted) ? decrypted.toString('utf8') : String(decrypted);
  return JSON.parse(jsonString);
}

/**
 * Encrypt an array
 */
export function encryptArray<T>(array: T[]): string {
  return encryptObject(array);
}

/**
 * Decrypt an array
 */
export function decryptArray<T = any>(encryptedValue: string): T[] {
  return decryptObject<T[]>(encryptedValue);
}

/**
 * Check if a value is encrypted (starts with { and contains encrypted fields)
 */
export function isEncrypted(value: any): boolean {
  if (typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'encrypted' in parsed &&
      'iv' in parsed &&
      'algorithm' in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Encrypt sensitive fields in an object based on a list of field names
 */
export function encryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: string[]
): T {
  const result = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in result && (result as any)[field] !== null && (result as any)[field] !== undefined) {
      if (!isEncrypted((result as any)[field])) {
        (result as any)[field] = encryptString(String((result as any)[field]));
      }
    }
  }
  
  return result;
}

/**
 * Decrypt sensitive fields in an object
 */
export function decryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: string[]
): T {
  const result = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in result && (result as any)[field] !== null && (result as any)[field] !== undefined) {
      if (isEncrypted((result as any)[field])) {
        try {
          (result as any)[field] = decryptString((result as any)[field]);
        } catch (error) {
          console.error(`[ENCRYPTION] Failed to decrypt field ${field}:`, error);
        }
      }
    }
  }
  
  return result;
}

