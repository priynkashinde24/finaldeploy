import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Discount Proposal Model
 * 
 * PURPOSE:
 * - Track discount proposals generated from dead stock alerts
 * - Require approval before application
 * - Track approval workflow
 * 
 * RULES:
 * - One proposal per SKU per alert
 * - Proposals expire if not approved
 * - Once approved, discount is applied via pricing system
 */

export type DiscountProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'applied';

export interface IDiscountProposal extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;
  skuId: mongoose.Types.ObjectId;
  sku: string;
  productId: mongoose.Types.ObjectId;
  deadStockAlertId: mongoose.Types.ObjectId; // Reference to DeadStockAlert

  // Discount details
  currentPrice: number; // Current selling price
  proposedPrice: number; // Proposed price after discount
  discountPercent: number; // Discount percentage
  discountAmount: number; // Discount amount (currentPrice - proposedPrice)

  // Proposal metadata
  status: DiscountProposalStatus;
  ruleId: mongoose.Types.ObjectId; // Reference to AutoDiscountRule
  reason: string; // Why this discount was proposed
  expectedImpact: {
    revenueLoss: number; // Expected revenue loss from discount
    expectedSalesIncrease: number; // Expected % increase in sales
    breakEvenDays: number; // Days to break even on revenue loss
  };

  // Approval workflow
  proposedAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId | string;
  approvedByRole?: 'admin' | 'supplier' | 'reseller';
  rejectedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId | string;
  rejectionReason?: string;

  // Application tracking
  appliedAt?: Date;
  appliedBy?: mongoose.Types.ObjectId | string;
  pricingRuleId?: mongoose.Types.ObjectId; // Reference to pricing rule if applied

  createdAt: Date;
  updatedAt: Date;
}

const DiscountProposalSchema: Schema = new Schema(
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
    skuId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: [true, 'SKU ID is required'],
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    deadStockAlertId: {
      type: Schema.Types.ObjectId,
      ref: 'DeadStockAlert',
      required: [true, 'Dead stock alert ID is required'],
      index: true,
    },
    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    proposedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired', 'applied'],
      required: true,
      default: 'pending',
      index: true,
    },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'AutoDiscountRule',
      required: [true, 'Rule ID is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
    },
    expectedImpact: {
      revenueLoss: { type: Number, required: true },
      expectedSalesIncrease: { type: Number, required: true },
      breakEvenDays: { type: Number, required: true },
    },
    proposedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: Schema.Types.Mixed,
    },
    approvedByRole: {
      type: String,
      enum: ['admin', 'supplier', 'reseller'],
    },
    rejectedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.Mixed,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    appliedAt: {
      type: Date,
    },
    appliedBy: {
      type: Schema.Types.Mixed,
    },
    pricingRuleId: {
      type: Schema.Types.ObjectId,
      ref: 'PricingRule',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
DiscountProposalSchema.index({ storeId: 1, scope: 1, status: 1, expiresAt: 1 });
DiscountProposalSchema.index({ storeId: 1, scope: 1, entityId: 1, status: 1 });
DiscountProposalSchema.index({ skuId: 1, status: 1 });
DiscountProposalSchema.index({ deadStockAlertId: 1, status: 1 });
DiscountProposalSchema.index({ expiresAt: 1, status: 1 }); // For expiration job

// Unique constraint: one pending proposal per SKU per alert
DiscountProposalSchema.index(
  { storeId: 1, scope: 1, entityId: 1, skuId: 1, deadStockAlertId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export const DiscountProposal: Model<IDiscountProposal> =
  mongoose.models.DiscountProposal || mongoose.model<IDiscountProposal>('DiscountProposal', DiscountProposalSchema);

