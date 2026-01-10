import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Data Encryption Service
 * 
 * PURPOSE:
 * - Provide field-level encryption for sensitive database fields
 * - Support multiple encryption algorithms
 * - Key management and rotation
 * - Encrypt/decrypt various data types
 * - Secure key derivation
 * 
 * SECURITY:
 * - AES-256-GCM (authenticated encryption) - Default
 * - AES-256-CBC (for compatibility)
 * - ChaCha20-Poly1305 (modern alternative)
 * - PBKDF2 key derivation
 * - Unique IV per encryption
 * - Key versioning for rotation
 */

export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';

export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
  keyVersion?: number;
  keyId?: string;
}

export interface EncryptedData {
  encrypted: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded IV
  tag?: string; // Base64 encoded auth tag (for GCM/Poly1305)
  algorithm: EncryptionAlgorithm;
  keyVersion: number;
  keyId?: string;
}

// Encryption configuration
const DEFAULT_ALGORITHM: EncryptionAlgorithm = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

// Key management
interface EncryptionKey {
  id: string;
  version: number;
  key: Buffer;
  algorithm: EncryptionAlgorithm;
  createdAt: Date;
  active: boolean;
}

class KeyManager {
  private keys: Map<string, EncryptionKey> = new Map();
  private currentKeyId: string | null = null;

  /**
   * Initialize key manager
   */
  initialize(): void {
    const masterKey = this.getMasterKey();
    const keyId = this.getKeyId();
    
    // Derive encryption key from master key
    const derivedKey = crypto.pbkdf2Sync(
      masterKey,
      'data-encryption-salt',
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha512'
    );

    const encryptionKey: EncryptionKey = {
      id: keyId,
      version: 1,
      key: derivedKey,
      algorithm: DEFAULT_ALGORITHM,
      createdAt: new Date(),
      active: true,
    };

    this.keys.set(keyId, encryptionKey);
    this.currentKeyId = keyId;
  }

  /**
   * Get master encryption key from environment
   */
  private getMasterKey(): string {
    const key = process.env.DATA_ENCRYPTION_KEY || 
                process.env.ENCRYPTION_KEY || 
                process.env.JWT_SECRET;

    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DATA_ENCRYPTION_KEY environment variable is required in production');
      }
      console.warn('[ENCRYPTION] Using default key. Set DATA_ENCRYPTION_KEY in production!');
      return 'default-encryption-key-change-in-production';
    }

    return key;
  }

  /**
   * Get key ID from environment or generate default
   */
  private getKeyId(): string {
    return process.env.ENCRYPTION_KEY_ID || 'default-key-v1';
  }

  /**
   * Get current active encryption key
   */
  getCurrentKey(): EncryptionKey {
    if (!this.currentKeyId) {
      this.initialize();
    }
    const key = this.keys.get(this.currentKeyId!);
    if (!key) {
      throw new Error('No encryption key available');
    }
    return key;
  }

  /**
   * Get encryption key by ID and version
   */
  getKey(keyId: string, version: number): EncryptionKey | null {
    const key = this.keys.get(keyId);
    if (key && key.version === version) {
      return key;
    }
    return null;
  }

  /**
   * Add a new encryption key (for rotation)
   */
  addKey(keyId: string, version: number, key: Buffer, algorithm: EncryptionAlgorithm = DEFAULT_ALGORITHM): void {
    const encryptionKey: EncryptionKey = {
      id: keyId,
      version,
      key,
      algorithm,
      createdAt: new Date(),
      active: true,
    };
    this.keys.set(keyId, encryptionKey);
  }

  /**
   * Rotate to a new key
   */
  rotateKey(): string {
    const currentKey = this.getCurrentKey();
    const newKeyId = `${this.getKeyId().split('-v')[0]}-v${currentKey.version + 1}`;
    const masterKey = this.getMasterKey();
    
    const derivedKey = crypto.pbkdf2Sync(
      masterKey,
      `data-encryption-salt-v${currentKey.version + 1}`,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha512'
    );

    this.addKey(newKeyId, currentKey.version + 1, derivedKey, currentKey.algorithm);
    
    // Mark old key as inactive but keep for decryption
    const oldKey = this.keys.get(this.currentKeyId!);
    if (oldKey) {
      oldKey.active = false;
    }
    
    this.currentKeyId = newKeyId;
    return newKeyId;
  }
}

// Singleton key manager instance
const keyManager = new KeyManager();

// Initialize on module load (Node.js only)
keyManager.initialize();

/**
 * Encrypt data
 */
export function encryptData(
  data: string | Buffer | object,
  options: EncryptionOptions = {}
): EncryptedData {
  const algorithm = options.algorithm || DEFAULT_ALGORITHM;
  const keyInfo = keyManager.getCurrentKey();
  const key = keyInfo.key;

  // Convert data to buffer
  let dataBuffer: Buffer;
  if (Buffer.isBuffer(data)) {
    dataBuffer = data;
  } else if (typeof data === 'object') {
    dataBuffer = Buffer.from(JSON.stringify(data), 'utf8');
  } else {
    dataBuffer = Buffer.from(String(data), 'utf8');
  }

  // Generate IV
  const iv = crypto.randomBytes(IV_LENGTH);

  let encrypted: Buffer;
  let tag: Buffer | undefined;

  if (algorithm === 'aes-256-gcm') {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final(),
    ]);
    tag = cipher.getAuthTag();
  } else if (algorithm === 'chacha20-poly1305') {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final(),
    ]);
    tag = cipher.getAuthTag();
  } else if (algorithm === 'aes-256-cbc') {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final(),
    ]);
    // CBC doesn't use auth tag
  } else {
    throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
  }

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag?.toString('base64'),
    algorithm,
    keyVersion: options.keyVersion || keyInfo.version,
    keyId: options.keyId || keyInfo.id,
  };
}

/**
 * Decrypt data
 */
export function decryptData(encryptedData: EncryptedData): string | Buffer {
  const { encrypted, iv, tag, algorithm, keyVersion, keyId } = encryptedData;

  // Get encryption key
  const keyInfo = keyId 
    ? keyManager.getKey(keyId, keyVersion)
    : keyManager.getCurrentKey();

  if (!keyInfo) {
    throw new Error(`Encryption key not found: ${keyId || 'default'} v${keyVersion}`);
  }

  const key = keyInfo.key;
  const ivBuffer = Buffer.from(iv, 'base64');
  const encryptedBuffer = Buffer.from(encrypted, 'base64');

  let decrypted: Buffer;

  if (algorithm === 'aes-256-gcm' || algorithm === 'chacha20-poly1305') {
    if (!tag) {
      throw new Error('Auth tag required for authenticated encryption');
    }
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer) as crypto.DecipherGCM;
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);
  } else if (algorithm === 'aes-256-cbc') {
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);
  } else {
    throw new Error(`Unsupported decryption algorithm: ${algorithm}`);
  }

  return decrypted;
}

/**
 * Decrypt data and parse as JSON
 */
export function decryptDataAsObject<T = any>(encryptedData: EncryptedData): T {
  const decrypted = decryptData(encryptedData);
  const jsonString = Buffer.isBuffer(decrypted) ? decrypted.toString('utf8') : decrypted;
  return JSON.parse(jsonString);
}

/**
 * Encrypt a field value (for database storage)
 * Returns a JSON string that can be stored in database
 */
export function encryptField(value: string | number | boolean | object | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    // Convert number/boolean to string for encryption
    const dataToEncrypt: string | Buffer | object = typeof value === 'number' || typeof value === 'boolean' 
      ? String(value) 
      : value;
    const encrypted = encryptData(dataToEncrypt);
    return JSON.stringify(encrypted);
  } catch (error) {
    console.error('[ENCRYPTION] Failed to encrypt field:', error);
    throw new Error('Failed to encrypt field value');
  }
}

/**
 * Decrypt a field value (from database)
 */
export function decryptField(encryptedValue: string | null | undefined): string | number | boolean | object | null {
  if (!encryptedValue) {
    return null;
  }

  try {
    const encryptedData: EncryptedData = JSON.parse(encryptedValue);
    const decrypted = decryptData(encryptedData);
    
    // Try to parse as JSON, fallback to string
    if (Buffer.isBuffer(decrypted)) {
      const str = decrypted.toString('utf8');
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    }
    
    return decrypted;
  } catch (error) {
    console.error('[ENCRYPTION] Failed to decrypt field:', error);
    throw new Error('Failed to decrypt field value');
  }
}

/**
 * Hash data (one-way, for comparison)
 */
export function hashData(data: string | Buffer, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  const hash = crypto.createHash(algorithm);
  if (Buffer.isBuffer(data)) {
    hash.update(data);
  } else {
    hash.update(data, 'utf8');
  }
  return hash.digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure random string
 */
export function generateSecureString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Rotate encryption key
 * Returns new key ID
 */
export function rotateEncryptionKey(): string {
  return keyManager.rotateKey();
}

/**
 * Get current encryption key info (for monitoring)
 */
export function getEncryptionKeyInfo(): {
  keyId: string;
  version: number;
  algorithm: EncryptionAlgorithm;
  active: boolean;
} {
  const key = keyManager.getCurrentKey();
  return {
    keyId: key.id,
    version: key.version,
    algorithm: key.algorithm,
    active: key.active,
  };
}

/**
 * Encrypt multiple fields in an object
 */
export function encryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted: any = { ...data };
  
  for (const field of fieldsToEncrypt) {
    if (field in data && data[field] !== null && data[field] !== undefined) {
      encrypted[field] = encryptField(data[field]);
    }
  }
  
  return encrypted;
}

/**
 * Decrypt multiple fields in an object
 */
export function decryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted: any = { ...data };
  
  for (const field of fieldsToDecrypt) {
    if (field in data && data[field] !== null && data[field] !== undefined) {
      try {
        decrypted[field] = decryptField(data[field] as string);
      } catch (error) {
        console.error(`[ENCRYPTION] Failed to decrypt field ${String(field)}:`, error);
        // Keep encrypted value on error
      }
    }
  }
  
  return decrypted;
}

/**
 * Mongoose schema plugin for field-level encryption
 * Usage: schema.plugin(encryptFieldsPlugin, { fields: ['ssn', 'bankAccount'] })
 */
export function encryptFieldsPlugin(schema: mongoose.Schema, options: { fields: string[] }) {
  const fieldsToEncrypt = options.fields || [];

  // Encrypt before saving
  schema.pre('save', function (next) {
    const doc = this as any;
    for (const field of fieldsToEncrypt) {
      if (doc[field] !== undefined && doc[field] !== null && typeof doc[field] === 'string') {
        // Check if already encrypted (starts with {)
        if (!doc[field].startsWith('{')) {
          try {
            doc[field] = encryptField(doc[field]);
          } catch (error) {
            return next(error as Error);
          }
        }
      }
    }
    next();
  });

  // Decrypt after retrieving
  schema.post('init', function () {
    const doc = this as any;
    for (const field of fieldsToEncrypt) {
      if (doc[field] !== undefined && doc[field] !== null && typeof doc[field] === 'string') {
        // Check if encrypted (starts with {)
        if (doc[field].startsWith('{')) {
          try {
            doc[field] = decryptField(doc[field]);
          } catch (error) {
            console.error(`[ENCRYPTION] Failed to decrypt field ${field}:`, error);
            // Keep encrypted value on error
          }
        }
      }
    }
  });

  schema.post('findOne', function (doc: any) {
    if (doc) {
      for (const field of fieldsToEncrypt) {
        if (doc[field] !== undefined && doc[field] !== null && typeof doc[field] === 'string') {
          if (doc[field].startsWith('{')) {
            try {
              doc[field] = decryptField(doc[field]);
            } catch (error) {
              console.error(`[ENCRYPTION] Failed to decrypt field ${field}:`, error);
            }
          }
        }
      }
    }
  });

  schema.post('find', function (docs: any[]) {
    if (docs) {
      for (const doc of docs) {
        for (const field of fieldsToEncrypt) {
          if (doc[field] !== undefined && doc[field] !== null && typeof doc[field] === 'string') {
            if (doc[field].startsWith('{')) {
              try {
                doc[field] = decryptField(doc[field]);
              } catch (error) {
                console.error(`[ENCRYPTION] Failed to decrypt field ${field}:`, error);
              }
            }
          }
        }
      }
    }
  });
}

