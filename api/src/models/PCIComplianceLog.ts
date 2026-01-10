import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * PCI Compliance Log Model
 * 
 * PURPOSE:
 * - Track PCI compliance events and violations
 * - Monitor access to payment data
 * - Maintain audit trail for PCI DSS compliance
 * 
 * PCI DSS Requirements:
 * - Requirement 10: Track and monitor all access to network resources and cardholder data
 * - Requirement 11: Regularly test security systems and processes
 */

export interface IPCIComplianceLog extends Document {
  storeId?: mongoose.Types.ObjectId | null; // Store (tenant) reference
  eventType: 'pci_data_detected' | 'pci_data_blocked' | 'pci_data_sanitized' | 'payment_access' | 'compliance_check' | 'violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: mongoose.Types.ObjectId | null; // User who triggered the event
  userRole?: 'admin' | 'supplier' | 'reseller' | 'customer' | 'system';
  ipAddress: string;
  userAgent: string;
  endpoint?: string; // API endpoint
  method?: string; // HTTP method
  fields?: string[]; // Fields that contained PCI data
  action: 'blocked' | 'sanitized' | 'logged' | 'allowed';
  metadata?: Record<string, any>;
  createdAt: Date;
}

const PCIComplianceLogSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['pci_data_detected', 'pci_data_blocked', 'pci_data_sanitized', 'payment_access', 'compliance_check', 'violation'],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userRole: {
      type: String,
      enum: ['admin', 'supplier', 'reseller', 'customer', 'system'],
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    endpoint: {
      type: String,
      default: null,
      index: true,
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      default: null,
    },
    fields: {
      type: [String],
      default: [],
    },
    action: {
      type: String,
      enum: ['blocked', 'sanitized', 'logged', 'allowed'],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
PCIComplianceLogSchema.index({ storeId: 1, createdAt: -1 });
PCIComplianceLogSchema.index({ eventType: 1, severity: 1, createdAt: -1 });
PCIComplianceLogSchema.index({ userId: 1, createdAt: -1 });
PCIComplianceLogSchema.index({ createdAt: -1 }); // For time-based queries

// TTL index: Delete logs older than 1 year (PCI DSS requires minimum 1 year retention)
PCIComplianceLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year in seconds

export const PCIComplianceLog: Model<IPCIComplianceLog> = mongoose.model<IPCIComplianceLog>(
  'PCIComplianceLog',
  PCIComplianceLogSchema
);

