import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

/**
 * Document Vault Model
 * 
 * PURPOSE:
 * - Secure document storage with encryption
 * - Version control and history tracking
 * - Fine-grained access control
 * - Document expiration and renewal
 * - Audit trail for compliance
 * 
 * SECURITY:
 * - Documents encrypted at rest
 * - Access controlled by roles and permissions
 * - All access logged for audit
 * - Supports document sharing with expiration
 */

export type DocumentCategory = 
  | 'kyc' 
  | 'invoice' 
  | 'contract' 
  | 'license' 
  | 'certificate' 
  | 'statement' 
  | 'agreement' 
  | 'other';

export type DocumentStatus = 'active' | 'archived' | 'expired' | 'deleted';

export type AccessPermission = 'read' | 'write' | 'delete' | 'share';

export interface IDocumentAccess extends Document {
  userId: mongoose.Types.ObjectId;
  role: 'admin' | 'supplier' | 'reseller' | 'customer' | 'delivery';
  permissions: AccessPermission[];
  grantedBy: mongoose.Types.ObjectId;
  grantedAt: Date;
  expiresAt?: Date | null;
}

export interface IDocumentVersion extends Document {
  version: number;
  filePath: string; // Encrypted file path
  fileSize: number;
  mimeType: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  checksum: string; // SHA-256 hash for integrity verification
  changeReason?: string;
}

export interface IDocumentShare extends Document {
  sharedWith: mongoose.Types.ObjectId; // User ID
  sharedBy: mongoose.Types.ObjectId;
  permissions: AccessPermission[];
  expiresAt?: Date | null;
  accessToken: string; // Unique token for secure sharing
  accessedAt?: Date | null;
  accessCount: number;
}

export interface IDocumentVault extends Document {
  storeId: mongoose.Types.ObjectId; // Store (tenant) reference - REQUIRED
  documentId: string; // Unique document identifier
  category: DocumentCategory;
  name: string; // Original filename
  description?: string;
  tags: string[]; // For searchability
  status: DocumentStatus;
  
  // Ownership
  ownerId: mongoose.Types.ObjectId; // User who owns the document
  ownerRole: 'admin' | 'supplier' | 'reseller' | 'customer' | 'delivery';
  
  // Current version
  currentVersion: number;
  currentFilePath: string; // Encrypted file path
  currentFileSize: number;
  currentMimeType: string;
  currentChecksum: string;
  
  // Version history
  versions: IDocumentVersion[];
  
  // Access control
  defaultPermissions: {
    owner: AccessPermission[];
    admin: AccessPermission[];
    supplier: AccessPermission[];
    reseller: AccessPermission[];
    customer: AccessPermission[];
    delivery: AccessPermission[];
  };
  customAccess: IDocumentAccess[]; // Custom access grants
  
  // Sharing
  shares: IDocumentShare[];
  isPublic: boolean; // Public documents accessible via share token
  publicAccessToken?: string; // Token for public access
  
  // Expiration
  expiresAt?: Date | null;
  autoRenew: boolean;
  renewalReminderDays: number; // Days before expiration to send reminder
  
  // Metadata
  metadata?: Record<string, any>; // Additional metadata (e.g., orderId, supplierId)
  relatedEntityType?: string; // e.g., 'Order', 'SupplierKYC', 'Contract'
  relatedEntityId?: mongoose.Types.ObjectId;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  lastAccessedAt?: Date | null;
  lastAccessedBy?: mongoose.Types.ObjectId | null;
  accessCount: number;
}

const DocumentAccessSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'supplier', 'reseller', 'customer', 'delivery'],
    required: true,
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete', 'share'],
  }],
  grantedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  grantedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, { _id: false });

const DocumentVersionSchema = new Schema({
  version: {
    type: Number,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  checksum: {
    type: String,
    required: true,
  },
  changeReason: {
    type: String,
    trim: true,
  },
}, { _id: false });

const DocumentShareSchema = new Schema({
  sharedWith: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sharedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete', 'share'],
  }],
  expiresAt: {
    type: Date,
    default: null,
  },
  accessToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  accessedAt: {
    type: Date,
    default: null,
  },
  accessCount: {
    type: Number,
    default: 0,
  },
}, { _id: false });

const DocumentVaultSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    documentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['kyc', 'invoice', 'contract', 'license', 'certificate', 'statement', 'agreement', 'other'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Document name must not exceed 500 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must not exceed 2000 characters'],
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    status: {
      type: String,
      enum: ['active', 'archived', 'expired', 'deleted'],
      default: 'active',
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ownerRole: {
      type: String,
      enum: ['admin', 'supplier', 'reseller', 'customer', 'delivery'],
      required: true,
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    currentFilePath: {
      type: String,
      required: true,
    },
    currentFileSize: {
      type: Number,
      required: true,
      min: [0, 'File size must be non-negative'],
    },
    currentMimeType: {
      type: String,
      required: true,
    },
    currentChecksum: {
      type: String,
      required: true,
    },
    versions: [DocumentVersionSchema],
    defaultPermissions: {
      owner: [{
        type: String,
        enum: ['read', 'write', 'delete', 'share'],
        default: ['read', 'write', 'delete', 'share'],
      }],
      admin: [{
        type: String,
        enum: ['read', 'write', 'delete', 'share'],
        default: ['read', 'write'],
      }],
      supplier: [{
        type: String,
        enum: ['read', 'write', 'delete', 'share'],
        default: [],
      }],
      reseller: [{
        type: String,
        enum: ['read', 'write', 'delete', 'share'],
        default: [],
      }],
      customer: [{
        type: String,
        enum: ['read', 'write', 'delete', 'share'],
        default: [],
      }],
      delivery: [{
        type: String,
        enum: ['read', 'write', 'delete', 'share'],
        default: [],
      }],
    },
    customAccess: [DocumentAccessSchema],
    shares: [DocumentShareSchema],
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    publicAccessToken: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    renewalReminderDays: {
      type: Number,
      default: 30,
      min: [0, 'Renewal reminder days must be non-negative'],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    relatedEntityType: {
      type: String,
      trim: true,
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    lastAccessedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
DocumentVaultSchema.index({ storeId: 1, category: 1, status: 1 });
DocumentVaultSchema.index({ storeId: 1, ownerId: 1, status: 1 });
DocumentVaultSchema.index({ storeId: 1, tags: 1 });
DocumentVaultSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
DocumentVaultSchema.index({ expiresAt: 1, status: 1 }); // For expiration queries
DocumentVaultSchema.index({ 'shares.sharedWith': 1 }); // For finding shared documents
DocumentVaultSchema.index({ 'shares.accessToken': 1 }); // For share token lookup

// Generate unique document ID
DocumentVaultSchema.pre('save', async function (next) {
  if (!this.documentId) {
    this.documentId = `doc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

// Generate public access token if document is public
DocumentVaultSchema.pre('save', async function (next) {
  if (this.isPublic && !this.publicAccessToken) {
    this.publicAccessToken = crypto.randomBytes(32).toString('hex');
  } else if (!this.isPublic) {
    this.publicAccessToken = null;
  }
  next();
});

export const DocumentVault: Model<IDocumentVault> = mongoose.model<IDocumentVault>(
  'DocumentVault',
  DocumentVaultSchema
);

