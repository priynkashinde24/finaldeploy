import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { DocumentVault, IDocumentVault, DocumentCategory, AccessPermission } from '../models/DocumentVault';
import { vaultUploadSingle } from '../utils/vaultUpload';
import {
  encryptAndStoreFile,
  decryptAndRetrieveFile,
  verifyFileIntegrity,
  generateTempFilePath,
  cleanupTempFile,
} from '../services/documentEncryption.service';
import {
  checkDocumentAccess,
  checkShareTokenAccess,
  recordDocumentAccess,
  grantCustomAccess,
  revokeCustomAccess,
  UserContext,
} from '../services/documentAccess.service';
import { logAudit } from '../utils/auditLogger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Document Vault Controller
 * 
 * Handles secure document storage, retrieval, sharing, and versioning
 */

const uploadDocumentSchema = z.object({
  category: z.enum(['kyc', 'invoice', 'contract', 'license', 'certificate', 'statement', 'agreement', 'other']),
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  expiresAt: z.string().optional(), // ISO date string
  autoRenew: z.boolean().optional(),
  renewalReminderDays: z.number().min(0).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  defaultPermissions: z.object({
    admin: z.array(z.enum(['read', 'write', 'delete', 'share'])).optional(),
    supplier: z.array(z.enum(['read', 'write', 'delete', 'share'])).optional(),
    reseller: z.array(z.enum(['read', 'write', 'delete', 'share'])).optional(),
    customer: z.array(z.enum(['read', 'write', 'delete', 'share'])).optional(),
    delivery: z.array(z.enum(['read', 'write', 'delete', 'share'])).optional(),
  }).optional(),
});

const shareDocumentSchema = z.object({
  sharedWith: z.string(), // User ID
  permissions: z.array(z.enum(['read', 'write', 'delete', 'share'])),
  expiresAt: z.string().optional(), // ISO date string
});

const updateVersionSchema = z.object({
  changeReason: z.string().max(500).optional(),
});

/**
 * POST /api/vault/documents
 * Upload a new document to the vault
 */
export const uploadDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    if (!req.file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    const validatedData = uploadDocumentSchema.parse(JSON.parse(req.body.data || '{}'));
    const { category, name, description, tags, expiresAt, autoRenew, renewalReminderDays, relatedEntityType, relatedEntityId, metadata, defaultPermissions } = validatedData;

    // Encrypt and store file
    const documentId = `doc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const encryptionResult = await encryptAndStoreFile(req.file.path, documentId, 1);

    // Create document record
    const document = new DocumentVault({
      storeId,
      documentId,
      category,
      name,
      description,
      tags: tags || [],
      status: 'active',
      ownerId: new mongoose.Types.ObjectId(currentUser.id),
      ownerRole: currentUser.role as any,
      currentVersion: 1,
      currentFilePath: encryptionResult.encryptedFilePath,
      currentFileSize: encryptionResult.fileSize,
      currentMimeType: req.file.mimetype,
      currentChecksum: encryptionResult.checksum,
      versions: [
        {
          version: 1,
          filePath: encryptionResult.encryptedFilePath,
          fileSize: encryptionResult.fileSize,
          mimeType: req.file.mimetype,
          uploadedBy: new mongoose.Types.ObjectId(currentUser.id),
          uploadedAt: new Date(),
          checksum: encryptionResult.checksum,
        },
      ],
      defaultPermissions: {
        owner: ['read', 'write', 'delete', 'share'],
        admin: defaultPermissions?.admin || ['read', 'write'],
        supplier: defaultPermissions?.supplier || [],
        reseller: defaultPermissions?.reseller || [],
        customer: defaultPermissions?.customer || [],
        delivery: defaultPermissions?.delivery || [],
      },
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      autoRenew: autoRenew || false,
      renewalReminderDays: renewalReminderDays || 30,
      relatedEntityType,
      relatedEntityId: relatedEntityId ? new mongoose.Types.ObjectId(relatedEntityId) : null,
      metadata: metadata || {},
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
    });

    await document.save();

    // Clean up temp upload file
    try {
      fs.unlinkSync(req.file.path);
    } catch (error) {
      console.warn('[DOCUMENT VAULT] Failed to cleanup temp file:', error);
    }

    // Audit log
    await logAudit({
      req,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'DocumentVault',
      entityId: document._id.toString(),
      description: `Document '${name}' uploaded to vault`,
      metadata: {
        documentId: document.documentId,
        category,
        fileSize: encryptionResult.fileSize,
      },
    });

    sendSuccess(
      res,
      {
        document: {
          id: document._id.toString(),
          documentId: document.documentId,
          name: document.name,
          category: document.category,
          status: document.status,
          currentVersion: document.currentVersion,
          createdAt: document.createdAt,
        },
      },
      'Document uploaded successfully'
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /api/vault/documents
 * List documents with filters
 */
export const listDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { category, status, tag, search, ownerId, relatedEntityType, relatedEntityId } = req.query;

    const filter: any = { storeId };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (tag) filter.tags = tag;
    if (ownerId) filter.ownerId = new mongoose.Types.ObjectId(ownerId as string);
    if (relatedEntityType) filter.relatedEntityType = relatedEntityType;
    if (relatedEntityId) filter.relatedEntityId = new mongoose.Types.ObjectId(relatedEntityId as string);

    // Search in name and description
    if (search) {
      filter.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { description: { $regex: search as string, $options: 'i' } },
      ];
    }

    // For non-admins, filter by access
    if (currentUser.role !== 'admin') {
      const userId = new mongoose.Types.ObjectId(currentUser.id);
      filter.$or = [
        { ownerId: userId },
        { 'customAccess.userId': userId },
        { 'shares.sharedWith': userId },
      ];
    }

    const documents = await DocumentVault.find(filter)
      .select('-currentFilePath -versions.filePath') // Don't expose file paths
      .populate('ownerId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, {
      documents: documents.map((doc) => ({
        id: doc._id.toString(),
        documentId: doc.documentId,
        name: doc.name,
        description: doc.description,
        category: doc.category,
        tags: doc.tags,
        status: doc.status,
        ownerId: doc.ownerId,
        ownerRole: doc.ownerRole,
        currentVersion: doc.currentVersion,
        currentFileSize: doc.currentFileSize,
        currentMimeType: doc.currentMimeType,
        expiresAt: doc.expiresAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        accessCount: doc.accessCount,
      })),
      total: documents.length,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/vault/documents/:documentId
 * Get document details
 */
export const getDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { documentId } = req.params;

    const document = await DocumentVault.findOne({ documentId, storeId });

    if (!document) {
      sendError(res, 'Document not found', 404);
      return;
    }

    // Check access
    const accessCheck = await checkDocumentAccess(document, {
      userId: currentUser.id,
      role: currentUser.role as any,
    }, 'read');

    if (!accessCheck.allowed) {
      sendError(res, accessCheck.reason || 'Access denied', 403);
      return;
    }

    // Record access
    await recordDocumentAccess(document, {
      userId: currentUser.id,
      role: currentUser.role as any,
    });

    sendSuccess(res, {
      document: {
        id: document._id.toString(),
        documentId: document.documentId,
        name: document.name,
        description: document.description,
        category: document.category,
        tags: document.tags,
        status: document.status,
        ownerId: document.ownerId,
        ownerRole: document.ownerRole,
        currentVersion: document.currentVersion,
        currentFileSize: document.currentFileSize,
        currentMimeType: document.currentMimeType,
        versions: document.versions.map((v) => ({
          version: v.version,
          fileSize: v.fileSize,
          mimeType: v.mimeType,
          uploadedAt: v.uploadedAt,
          uploadedBy: v.uploadedBy,
          changeReason: v.changeReason,
        })),
        expiresAt: document.expiresAt,
        autoRenew: document.autoRenew,
        relatedEntityType: document.relatedEntityType,
        relatedEntityId: document.relatedEntityId,
        metadata: document.metadata,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        lastAccessedAt: document.lastAccessedAt,
        accessCount: document.accessCount,
        permissions: accessCheck.permissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/vault/documents/:documentId/download
 * Download document (decrypted)
 */
export const downloadDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { documentId } = req.params;
    const { version } = req.query;
    const requestedVersion = version ? parseInt(version as string) : undefined;

    const document = await DocumentVault.findOne({ documentId, storeId });

    if (!document) {
      sendError(res, 'Document not found', 404);
      return;
    }

    // Check access
    const accessCheck = await checkDocumentAccess(document, {
      userId: currentUser.id,
      role: currentUser.role as any,
    }, 'read');

    if (!accessCheck.allowed) {
      sendError(res, accessCheck.reason || 'Access denied', 403);
      return;
    }

    // Get version to download
    const versionToDownload = requestedVersion
      ? document.versions.find((v) => v.version === requestedVersion)
      : document.versions[document.versions.length - 1]; // Latest version

    if (!versionToDownload) {
      sendError(res, 'Version not found', 404);
      return;
    }

    // Decrypt file
    const decryptedData = await decryptAndRetrieveFile(versionToDownload.filePath);

    // Verify integrity
    if (!verifyFileIntegrity(decryptedData, versionToDownload.checksum)) {
      sendError(res, 'File integrity check failed', 500);
      return;
    }

    // Record access
    await recordDocumentAccess(document, {
      userId: currentUser.id,
      role: currentUser.role as any,
    });

    // Set response headers
    res.setHeader('Content-Type', versionToDownload.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    res.setHeader('Content-Length', decryptedData.length.toString());

    // Send file
    res.send(decryptedData);
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/vault/documents/:documentId/versions
 * Upload a new version of the document
 */
export const uploadNewVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    if (!req.file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    const { documentId } = req.params;
    const validatedData = updateVersionSchema.parse(JSON.parse(req.body.data || '{}'));
    const { changeReason } = validatedData;

    const document = await DocumentVault.findOne({ documentId, storeId });

    if (!document) {
      sendError(res, 'Document not found', 404);
      return;
    }

    // Check write access
    const accessCheck = await checkDocumentAccess(document, {
      userId: currentUser.id,
      role: currentUser.role as any,
    }, 'write');

    if (!accessCheck.allowed) {
      sendError(res, accessCheck.reason || 'Access denied', 403);
      return;
    }

    // Encrypt and store new version
    const newVersion = document.currentVersion + 1;
    const encryptionResult = await encryptAndStoreFile(req.file.path, document.documentId, newVersion);

    // Add version to history
    document.versions.push({
      version: newVersion,
      filePath: encryptionResult.encryptedFilePath,
      fileSize: encryptionResult.fileSize,
      mimeType: req.file.mimetype,
      uploadedBy: new mongoose.Types.ObjectId(currentUser.id),
      uploadedAt: new Date(),
      checksum: encryptionResult.checksum,
      changeReason: changeReason || 'Version update',
    } as any);

    // Update current version
    document.currentVersion = newVersion;
    document.currentFilePath = encryptionResult.encryptedFilePath;
    document.currentFileSize = encryptionResult.fileSize;
    document.currentMimeType = req.file.mimetype;
    document.currentChecksum = encryptionResult.checksum;

    await document.save();

    // Clean up temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch (error) {
      console.warn('[DOCUMENT VAULT] Failed to cleanup temp file:', error);
    }

    // Audit log
    await logAudit({
      req,
      action: 'DOCUMENT_VERSION_UPLOADED',
      entityType: 'DocumentVault',
      entityId: document._id.toString(),
      description: `New version ${newVersion} uploaded for document '${document.name}'`,
      metadata: {
        documentId: document.documentId,
        version: newVersion,
        changeReason,
      },
    });

    sendSuccess(
      res,
      {
        document: {
          id: document._id.toString(),
          documentId: document.documentId,
          currentVersion: document.currentVersion,
        },
      },
      'New version uploaded successfully'
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * POST /api/vault/documents/:documentId/share
 * Share document with another user
 */
export const shareDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { documentId } = req.params;
    const validatedData = shareDocumentSchema.parse(req.body);
    const { sharedWith, permissions, expiresAt } = validatedData;

    const document = await DocumentVault.findOne({ documentId, storeId });

    if (!document) {
      sendError(res, 'Document not found', 404);
      return;
    }

    // Check share permission
    const accessCheck = await checkDocumentAccess(document, {
      userId: currentUser.id,
      role: currentUser.role as any,
    }, 'share');

    if (!accessCheck.allowed) {
      sendError(res, accessCheck.reason || 'Access denied', 403);
      return;
    }

    // Generate share token
    const accessToken = crypto.randomBytes(32).toString('hex');

    // Add share
    document.shares.push({
      sharedWith: new mongoose.Types.ObjectId(sharedWith),
      sharedBy: new mongoose.Types.ObjectId(currentUser.id),
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      accessToken,
      accessedAt: null,
      accessCount: 0,
    } as any);

    await document.save();

    // Audit log
    await logAudit({
      req,
      action: 'DOCUMENT_SHARED',
      entityType: 'DocumentVault',
      entityId: document._id.toString(),
      description: `Document '${document.name}' shared with user ${sharedWith}`,
      metadata: {
        documentId: document.documentId,
        sharedWith,
        permissions,
        expiresAt,
      },
    });

    sendSuccess(
      res,
      {
        share: {
          accessToken,
          expiresAt: expiresAt || null,
        },
      },
      'Document shared successfully'
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /api/vault/documents/shared/:shareToken
 * Access document via share token (public endpoint)
 */
export const accessSharedDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { shareToken } = req.params;

    const document = await DocumentVault.findOne({
      $or: [
        { 'shares.accessToken': shareToken },
        { publicAccessToken: shareToken },
      ],
    });

    if (!document) {
      sendError(res, 'Document not found or invalid share token', 404);
      return;
    }

    // Check share token access
    const accessCheck = await checkShareTokenAccess(document, shareToken, 'read');

    if (!accessCheck.allowed) {
      sendError(res, accessCheck.reason || 'Access denied', 403);
      return;
    }

    // Decrypt and send file
    const decryptedData = await decryptAndRetrieveFile(document.currentFilePath);

    // Verify integrity
    if (!verifyFileIntegrity(decryptedData, document.currentChecksum)) {
      sendError(res, 'File integrity check failed', 500);
      return;
    }

    // Set response headers
    res.setHeader('Content-Type', document.currentMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    res.setHeader('Content-Length', decryptedData.length.toString());

    // Send file
    res.send(decryptedData);
  } catch (error: any) {
    next(error);
  }
};

/**
 * DELETE /api/vault/documents/:documentId
 * Delete document (soft delete - marks as deleted)
 */
export const deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { documentId } = req.params;

    const document = await DocumentVault.findOne({ documentId, storeId });

    if (!document) {
      sendError(res, 'Document not found', 404);
      return;
    }

    // Check delete permission
    const accessCheck = await checkDocumentAccess(document, {
      userId: currentUser.id,
      role: currentUser.role as any,
    }, 'delete');

    if (!accessCheck.allowed) {
      sendError(res, accessCheck.reason || 'Access denied', 403);
      return;
    }

    // Soft delete
    document.status = 'deleted';
    await document.save();

    // Audit log
    await logAudit({
      req,
      action: 'DOCUMENT_DELETED',
      entityType: 'DocumentVault',
      entityId: document._id.toString(),
      description: `Document '${document.name}' deleted`,
      metadata: {
        documentId: document.documentId,
      },
    });

    sendSuccess(res, {}, 'Document deleted successfully');
  } catch (error: any) {
    next(error);
  }
};

// vaultUploadSingle is imported from '../utils/vaultUpload' and used in routes

