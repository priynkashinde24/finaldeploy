import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Document Encryption Service
 * 
 * PURPOSE:
 * - Encrypt documents at rest using AES-256-GCM
 * - Decrypt documents for authorized access
 * - Generate secure file paths
 * - Verify file integrity using checksums
 * 
 * SECURITY:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Unique IV per file
 * - Key derivation from environment variable
 * - File integrity verification
 */

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

// Get encryption key from environment or generate a default (for development only)
function getEncryptionKey(): Buffer {
  const keyFromEnv = process.env.DOCUMENT_ENCRYPTION_KEY;
  
  if (keyFromEnv) {
    // Use provided key (should be 64 hex characters = 32 bytes)
    if (keyFromEnv.length === 64) {
      return Buffer.from(keyFromEnv, 'hex');
    }
    // Derive key from password using PBKDF2
    return crypto.pbkdf2Sync(keyFromEnv, 'document-vault-salt', 100000, KEY_LENGTH, 'sha512');
  }
  
  // Development fallback - WARNING: Not secure for production!
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DOCUMENT_ENCRYPTION_KEY environment variable is required in production');
  }
  
  // Generate a deterministic key for development (NOT SECURE)
  return crypto.pbkdf2Sync('dev-key-change-in-production', 'dev-salt', 1000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt a file and save to secure storage
 */
export async function encryptAndStoreFile(
  sourceFilePath: string,
  documentId: string,
  version: number
): Promise<{
  encryptedFilePath: string;
  checksum: string;
  fileSize: number;
}> {
  const key = getEncryptionKey();
  
  // Read source file
  const fileData = fs.readFileSync(sourceFilePath);
  const fileSize = fileData.length;
  
  // Generate checksum for integrity verification
  const checksum = crypto.createHash('sha256').update(fileData).digest('hex');
  
  // Generate IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  // Encrypt file
  const encrypted = Buffer.concat([
    cipher.update(fileData),
    cipher.final(),
  ]);
  
  // Get authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine IV + tag + encrypted data
  const encryptedData = Buffer.concat([iv, tag, encrypted]);
  
  // Create secure storage directory
  const vaultDir = path.join(process.cwd(), 'vault', 'documents', documentId);
  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true });
  }
  
  // Save encrypted file
  const encryptedFilePath = path.join(vaultDir, `v${version}.enc`);
  fs.writeFileSync(encryptedFilePath, encryptedData);
  
  return {
    encryptedFilePath,
    checksum,
    fileSize,
  };
}

/**
 * Decrypt a file from secure storage
 */
export async function decryptAndRetrieveFile(
  encryptedFilePath: string
): Promise<Buffer> {
  const key = getEncryptionKey();
  
  // Read encrypted file
  const encryptedData = fs.readFileSync(encryptedFilePath);
  
  // Extract IV, tag, and encrypted content
  const iv = encryptedData.slice(0, IV_LENGTH);
  const tag = encryptedData.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = encryptedData.slice(IV_LENGTH + TAG_LENGTH);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt file
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return decrypted;
}

/**
 * Verify file integrity using checksum
 */
export function verifyFileIntegrity(fileData: Buffer, expectedChecksum: string): boolean {
  const actualChecksum = crypto.createHash('sha256').update(fileData).digest('hex');
  return actualChecksum === expectedChecksum;
}

/**
 * Generate secure temporary file path for decrypted files
 */
export function generateTempFilePath(documentId: string, version: number): string {
  const tempDir = path.join(process.cwd(), 'vault', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFileName = `${documentId}_v${version}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  return path.join(tempDir, tempFileName);
}

/**
 * Clean up temporary file
 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('[DOCUMENT ENCRYPTION] Failed to cleanup temp file:', error);
  }
}

/**
 * Get file metadata without decrypting
 */
export function getEncryptedFileMetadata(encryptedFilePath: string): {
  fileSize: number;
  encryptedSize: number;
} {
  const stats = fs.statSync(encryptedFilePath);
  const encryptedSize = stats.size;
  
  // Encrypted size = IV (16) + Tag (16) + Encrypted data
  // Actual file size is encrypted size - IV - Tag
  const fileSize = encryptedSize - IV_LENGTH - TAG_LENGTH;
  
  return {
    fileSize,
    encryptedSize,
  };
}

