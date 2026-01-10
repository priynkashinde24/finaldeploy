import { Request } from 'express';
import { AuditLog } from '../models/AuditLog';
import mongoose from 'mongoose';
import { sanitizePCIData } from '../services/pciCompliance.service';

// Keys to mask in audit payloads
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'resetToken',
  'otp',
  'otpCode',
  'secret',
  'apiKey',
  'apiSecret',
  // PCI-sensitive keys
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
 * Deeply mask sensitive fields and truncate large payloads
 */
function maskAndTruncate(value: any, maxLength = 10_000, currentLength = { len: 0 }): any {
  if (value === null || value === undefined) return value;

  // Primitive types
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const str = String(value);
    currentLength.len += str.length;
    if (currentLength.len > maxLength) return '[TRUNCATED]';
    return value;
  }

  // Dates
  if (value instanceof Date) {
    const str = value.toISOString();
    currentLength.len += str.length;
    if (currentLength.len > maxLength) return '[TRUNCATED]';
    return str;
  }

  // Arrays
  if (Array.isArray(value)) {
    const arr: any[] = [];
    for (const item of value) {
      if (currentLength.len > maxLength) {
        arr.push('[TRUNCATED]');
        break;
      }
      arr.push(maskAndTruncate(item, maxLength, currentLength));
    }
    return arr;
  }

  // Objects
  if (typeof value === 'object') {
    const obj: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      if (currentLength.len > maxLength) {
        obj[key] = '[TRUNCATED]';
        continue;
      }
      // Mask sensitive keys
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        obj[key] = '[MASKED]';
        continue;
      }
      obj[key] = maskAndTruncate(val, maxLength, currentLength);
    }
    return obj;
  }

  // Fallback
  const str = String(value);
  currentLength.len += str.length;
  if (currentLength.len > maxLength) return '[TRUNCATED]';
  return str;
}

export interface AuditLogParams {
  req?: Request; // Request object (extracts storeId, actorId, IP, userAgent)
  storeId?: string | mongoose.Types.ObjectId | null; // Store ID (optional, extracted from req.store if not provided)
  actorId?: string | mongoose.Types.ObjectId | null; // Actor ID (optional, extracted from req.user if not provided)
  actorRole?: 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system'; // Actor role (optional, extracted from req.user if not provided)
  action: string; // Action name (e.g., "LOGIN_SUCCESS", "PRICE_RULE_UPDATED")
  entityType: string; // Entity type (e.g., "Order", "Product", "PricingRule")
  entityId?: string | mongoose.Types.ObjectId | null; // Entity ID (optional)
  before?: Record<string, any> | null; // Snapshot before change
  after?: Record<string, any> | null; // Snapshot after change
  description: string; // Human-readable description
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Log an audit event
 * Never throws errors - audit failure must not block business logic
 * 
 * Automatically extracts:
 * - storeId from req.store (if available)
 * - actorId from req.user (if available)
 * - actorRole from req.user (if available)
 * - IP address and user agent from req
 */
export const logAudit = async (params: AuditLogParams): Promise<void> => {
  try {
    const {
      req,
      storeId: providedStoreId,
      actorId: providedActorId,
      actorRole: providedActorRole,
      action,
      entityType,
      entityId,
      before,
      after,
      description,
      metadata = {},
    } = params;

    // Extract storeId from req.store (multi-tenant support)
    let storeId: mongoose.Types.ObjectId | null = null;
    if (providedStoreId) {
      storeId = typeof providedStoreId === 'string' 
        ? new mongoose.Types.ObjectId(providedStoreId)
        : providedStoreId;
    } else if (req?.store?.storeId) {
      storeId = new mongoose.Types.ObjectId(req.store.storeId);
    }

    // Extract actorId from req.user
    let actorId: mongoose.Types.ObjectId | null = null;
    if (providedActorId) {
      actorId = typeof providedActorId === 'string'
        ? new mongoose.Types.ObjectId(providedActorId)
        : providedActorId;
    } else if (req?.user?.id) {
      actorId = new mongoose.Types.ObjectId(req.user.id);
    }

    // Extract actorRole from req.user
    let actorRole: 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system' = providedActorRole || 'system';
    if (!providedActorRole && req?.user?.role) {
      actorRole = req.user.role as 'admin' | 'supplier' | 'reseller';
    }

    // Extract IP address and user agent from request
    let ipAddress = 'unknown';
    let userAgent = 'unknown';

    if (req) {
      // Get IP address (considering proxies)
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];
      
      if (forwardedFor) {
        ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim() || 'unknown';
      } else if (realIp) {
        ipAddress = Array.isArray(realIp) ? realIp[0] : realIp;
      } else {
        ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      }

      userAgent = req.headers['user-agent'] || 'unknown';
    }

    // Convert entityId to ObjectId if provided as string
    let entityObjectId: mongoose.Types.ObjectId | null = null;
    if (entityId) {
      entityObjectId = typeof entityId === 'string'
        ? new mongoose.Types.ObjectId(entityId)
        : entityId;
    }

    // Mask and truncate sensitive data to avoid logging secrets or huge payloads
    const sanitizePayload = (payload: Record<string, any> | null | undefined) => {
      if (!payload || typeof payload !== 'object') return payload || null;
      // First sanitize PCI data, then truncate
      const pciSanitized = sanitizePCIData(payload);
      return maskAndTruncate(pciSanitized, 10_000); // cap at ~10KB
    };

    // Create audit log entry
    const auditLogData: any = {
      storeId,
      actorId,
      actorRole,
      action,
      entityType,
      entityId: entityObjectId,
      before: sanitizePayload(before),
      after: sanitizePayload(after),
      description,
      ipAddress,
      userAgent,
      metadata: sanitizePayload(metadata) || {},
    };

    // Legacy field for backward compatibility
    if (actorId) {
      auditLogData.actorUserId = actorId;
    }

    await AuditLog.create(auditLogData);
  } catch (error) {
    // Never throw - audit logging failure should not break the application
    console.error('Audit logging failed:', error);
  }
};

