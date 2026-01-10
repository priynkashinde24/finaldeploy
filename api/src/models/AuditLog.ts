import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId | null; // Store (tenant) reference - null for system-wide actions
  actorId: mongoose.Types.ObjectId | null; // User ID (null for system actions)
  actorRole: 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system';
  action: string; // e.g. "LOGIN_SUCCESS", "PRICE_RULE_UPDATED", "ORDER_CREATED"
  entityType: string; // e.g. "Order", "Product", "PricingRule"
  entityId: mongoose.Types.ObjectId | null; // Entity ID (null if not applicable)
  before: Record<string, any> | null; // Snapshot before change
  after: Record<string, any> | null; // Snapshot after change
  description: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  // Legacy fields for backward compatibility
  actorUserId?: mongoose.Types.ObjectId;
}

const AuditLogSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
      // null for system-wide actions (e.g., user registration before store assignment)
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      // null for system actions (e.g., automated jobs)
    },
    actorRole: {
      type: String,
      enum: ['admin', 'supplier', 'reseller', 'affiliate', 'system'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      // Examples: "LOGIN_SUCCESS", "PRICE_RULE_UPDATED", "ORDER_CREATED", "STORE_SUSPENDED"
    },
    entityType: {
      type: String,
      required: true,
      index: true,
      // Examples: "Order", "Product", "PricingRule", "Store", "User"
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
      // null if action doesn't target a specific entity
    },
    before: {
      type: Schema.Types.Mixed,
      default: null,
      // Snapshot of entity before change (for updates/deletes)
    },
    after: {
      type: Schema.Types.Mixed,
      default: null,
      // Snapshot of entity after change (for creates/updates)
    },
    description: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Legacy field for backward compatibility
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries (storeId is primary filter for multi-tenant)
AuditLogSchema.index({ storeId: 1, createdAt: -1 }); // Primary: Get logs by store
AuditLogSchema.index({ storeId: 1, actorId: 1, createdAt: -1 }); // Get logs by store and actor
AuditLogSchema.index({ storeId: 1, action: 1, createdAt: -1 }); // Get logs by store and action
AuditLogSchema.index({ storeId: 1, entityType: 1, entityId: 1, createdAt: -1 }); // Get logs for specific entity
AuditLogSchema.index({ actorId: 1, createdAt: -1 }); // Get logs by actor (across stores)
AuditLogSchema.index({ action: 1, createdAt: -1 }); // Get logs by action (across stores)
AuditLogSchema.index({ entityType: 1, createdAt: -1 }); // Get logs by entity type (across stores)
AuditLogSchema.index({ createdAt: -1 }); // Get recent logs
// Legacy index for backward compatibility
AuditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

