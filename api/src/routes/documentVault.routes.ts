import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  uploadNewVersion,
  shareDocument,
  accessSharedDocument,
  deleteDocument,
} from '../controllers/documentVault.controller';
import { vaultUploadSingle } from '../utils/vaultUpload';

const router = Router();

/**
 * Document Vault Routes
 */

// All routes require authentication and store context
router.use(authenticate);
router.use(resolveStore);

// Upload new document
router.post('/vault/documents', vaultUploadSingle, uploadDocument);

// List documents
router.get('/vault/documents', listDocuments);

// Get document details
router.get('/vault/documents/:documentId', getDocument);

// Download document
router.get('/vault/documents/:documentId/download', downloadDocument);

// Upload new version
router.post('/vault/documents/:documentId/versions', vaultUploadSingle, uploadNewVersion);

// Share document
router.post('/vault/documents/:documentId/share', shareDocument);

// Delete document
router.delete('/vault/documents/:documentId', deleteDocument);

// Public share access (no auth required, but token validated)
router.get('/vault/documents/shared/:shareToken', accessSharedDocument);

export default router;

