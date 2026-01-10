import mongoose from 'mongoose';
import { DocumentVault, IDocumentVault, AccessPermission } from '../models/DocumentVault';

/**
 * Document Access Control Service
 * 
 * PURPOSE:
 * - Check user permissions for documents
 * - Enforce access control rules
 * - Track document access for audit
 */

export interface AccessCheckResult {
  allowed: boolean;
  permissions: AccessPermission[];
  reason?: string;
}

export interface UserContext {
  userId: mongoose.Types.ObjectId | string;
  role: 'admin' | 'supplier' | 'reseller' | 'customer' | 'delivery';
}

/**
 * Check if user has permission to access document
 */
export async function checkDocumentAccess(
  document: IDocumentVault,
  user: UserContext,
  requiredPermission: AccessPermission
): Promise<AccessCheckResult> {
  const userId = typeof user.userId === 'string' ? new mongoose.Types.ObjectId(user.userId) : user.userId;
  
  // Owner always has full access
  if (document.ownerId.toString() === userId.toString()) {
    return {
      allowed: true,
      permissions: ['read', 'write', 'delete', 'share'],
    };
  }
  
  // Admin has read and write by default (unless restricted)
  if (user.role === 'admin') {
    const adminPermissions = document.defaultPermissions.admin || ['read', 'write'];
    if (adminPermissions.includes(requiredPermission)) {
      return {
        allowed: true,
        permissions: adminPermissions,
      };
    }
  }
  
  // Check default role permissions
  const rolePermissions = document.defaultPermissions[user.role] || [];
  if (rolePermissions.includes(requiredPermission)) {
    return {
      allowed: true,
      permissions: rolePermissions,
    };
  }
  
  // Check custom access grants
  const customAccess = document.customAccess.find(
    (access) => access.userId.toString() === userId.toString()
  );
  
  if (customAccess) {
    // Check if access has expired
    if (customAccess.expiresAt && customAccess.expiresAt < new Date()) {
      return {
        allowed: false,
        permissions: [],
        reason: 'Custom access has expired',
      };
    }
    
    if (customAccess.permissions.includes(requiredPermission)) {
      return {
        allowed: true,
        permissions: customAccess.permissions,
      };
    }
  }
  
  // Check shares
  const share = document.shares.find(
    (s) => s.sharedWith.toString() === userId.toString()
  );
  
  if (share) {
    // Check if share has expired
    if (share.expiresAt && share.expiresAt < new Date()) {
      return {
        allowed: false,
        permissions: [],
        reason: 'Share access has expired',
      };
    }
    
    if (share.permissions.includes(requiredPermission)) {
      return {
        allowed: true,
        permissions: share.permissions,
      };
    }
  }
  
  // Check public access (for read only)
  if (document.isPublic && requiredPermission === 'read') {
    return {
      allowed: true,
      permissions: ['read'],
    };
  }
  
  return {
    allowed: false,
    permissions: [],
    reason: 'Insufficient permissions',
  };
}

/**
 * Check access via share token
 */
export async function checkShareTokenAccess(
  document: IDocumentVault,
  shareToken: string,
  requiredPermission: AccessPermission = 'read'
): Promise<AccessCheckResult> {
  // Check public access token
  if (document.isPublic && document.publicAccessToken === shareToken) {
    if (requiredPermission === 'read') {
      return {
        allowed: true,
        permissions: ['read'],
      };
    }
  }
  
  // Check share tokens
  const share = document.shares.find((s) => s.accessToken === shareToken);
  
  if (share) {
    // Check if share has expired
    if (share.expiresAt && share.expiresAt < new Date()) {
      return {
        allowed: false,
        permissions: [],
        reason: 'Share access has expired',
      };
    }
    
    if (share.permissions.includes(requiredPermission)) {
      // Update share access tracking
      share.accessedAt = new Date();
      share.accessCount += 1;
      await document.save();
      
      return {
        allowed: true,
        permissions: share.permissions,
      };
    }
  }
  
  return {
    allowed: false,
    permissions: [],
    reason: 'Invalid or expired share token',
  };
}

/**
 * Record document access for audit
 */
export async function recordDocumentAccess(
  document: IDocumentVault,
  user: UserContext
): Promise<void> {
  const userId = typeof user.userId === 'string' ? new mongoose.Types.ObjectId(user.userId) : user.userId;
  
  document.lastAccessedAt = new Date();
  document.lastAccessedBy = userId;
  document.accessCount += 1;
  
  await document.save();
}

/**
 * Grant custom access to a user
 */
export async function grantCustomAccess(
  document: IDocumentVault,
  targetUserId: mongoose.Types.ObjectId,
  permissions: AccessPermission[],
  grantedBy: mongoose.Types.ObjectId,
  expiresAt?: Date | null
): Promise<void> {
  // Remove existing access if any
  document.customAccess = document.customAccess.filter(
    (access) => access.userId.toString() !== targetUserId.toString()
  );
  
  // Add new access
  document.customAccess.push({
    userId: targetUserId,
    role: 'admin', // Will be populated from user
    permissions,
    grantedBy,
    grantedAt: new Date(),
    expiresAt: expiresAt || null,
  } as any);
  
  await document.save();
}

/**
 * Revoke custom access
 */
export async function revokeCustomAccess(
  document: IDocumentVault,
  targetUserId: mongoose.Types.ObjectId
): Promise<void> {
  document.customAccess = document.customAccess.filter(
    (access) => access.userId.toString() !== targetUserId.toString()
  );
  
  await document.save();
}

