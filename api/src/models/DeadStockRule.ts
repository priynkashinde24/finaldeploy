import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Dead Stock Rule Model
 * 
 * PURPOSE:
 * - Configurable rules for detecting dead stock
 * - One active rule per scope (admin/supplier/reseller) per store
 * - Store-level override allowed
 * 
 * RULES:
 * - One active rule per scope per store
 * - Rules are evaluated daily by deadStockDetector.job.ts
 */

export interface IDeadStockRule extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null; // Supplier ID or Reseller ID (null for admin)

  // Detection criteria
  daysWithoutSales: number; // No orders in last N days (default: 30)
  minStockThreshold: number; // Minimum stock level to trigger alert (default: 1)
  velocityThreshold?: number; // Optional: sales velocity threshold (units per day)
  maxStockAgingDays?: number; // Optional: max days since first stock entry

  // Alert severity
  severity: 'warning' | 'critical'; // Alert severity level
  isActive: boolean; // Whether this rule is active

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const DeadStockRuleSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['admin', 'supplier', 'reseller'],
      required: [true, 'Scope is required'],
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    daysWithoutSales: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
      max: 365,
    },
    minStockThreshold: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    velocityThreshold: {
      type: Number,
      min: 0,
      default: null,
    },
    maxStockAgingDays: {
      type: Number,
      min: 0,
      default: null,
    },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      required: true,
      default: 'warning',
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
DeadStockRuleSchema.index({ storeId: 1, scope: 1, isActive: 1 });
DeadStockRuleSchema.index({ storeId: 1, scope: 1, entityId: 1, isActive: 1 });

// Unique constraint: one active rule per scope per store
DeadStockRuleSchema.index(
  { storeId: 1, scope: 1, entityId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const DeadStockRule: Model<IDeadStockRule> =
  mongoose.models.DeadStockRule || mongoose.model<IDeadStockRule>('DeadStockRule', DeadStockRuleSchema);

