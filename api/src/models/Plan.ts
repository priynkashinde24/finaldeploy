import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Plan Model
 * 
 * PURPOSE:
 * - Define subscription plans for resellers and suppliers
 * - Control feature access & limits
 * - Admin-defined plans only
 * 
 * RULES:
 * - Plans are role-specific (reseller or supplier)
 * - Only admin can create/edit plans
 * - Inactive plans cannot be assigned
 * - Plans define feature limits and access
 */

export interface IPlan extends Document {
  name: string; // e.g., "Starter", "Pro", "Enterprise"
  role: 'reseller' | 'supplier'; // Role this plan is for
  priceMonthly: number; // Monthly price (₹)
  priceYearly: number; // Yearly price (₹)
  features: {
    maxProducts: number | null; // null = unlimited
    maxVariants: number | null; // null = unlimited
    maxOrdersPerMonth: number | null; // null = unlimited
    analyticsAccess: boolean; // Access to analytics dashboard
    dynamicPricingAccess: boolean; // Access to dynamic pricing features
    aiPricingAccess: boolean; // Access to AI pricing suggestions
    multiStoreAccess: boolean; // Can create multiple stores (resellers only)
    customDomainAccess: boolean; // Custom domain support
    prioritySupport: boolean; // Priority customer support
  };
  status: 'active' | 'inactive';
  description?: string; // Plan description
  createdBy: mongoose.Types.ObjectId; // Admin who created this plan
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      maxlength: [100, 'Plan name must not exceed 100 characters'],
      index: true,
    },
    role: {
      type: String,
      enum: ['reseller', 'supplier'],
      required: [true, 'Role is required'],
      index: true,
    },
    priceMonthly: {
      type: Number,
      required: [true, 'Monthly price is required'],
      min: [0, 'Monthly price must be non-negative'],
    },
    priceYearly: {
      type: Number,
      required: [true, 'Yearly price is required'],
      min: [0, 'Yearly price must be non-negative'],
    },
    features: {
      maxProducts: {
        type: Number,
        default: null, // null = unlimited
        min: [0, 'Max products must be non-negative'],
      },
      maxVariants: {
        type: Number,
        default: null, // null = unlimited
        min: [0, 'Max variants must be non-negative'],
      },
      maxOrdersPerMonth: {
        type: Number,
        default: null, // null = unlimited
        min: [0, 'Max orders per month must be non-negative'],
      },
      analyticsAccess: {
        type: Boolean,
        default: false,
      },
      dynamicPricingAccess: {
        type: Boolean,
        default: false,
      },
      aiPricingAccess: {
        type: Boolean,
        default: false,
      },
      multiStoreAccess: {
        type: Boolean,
        default: false,
      },
      customDomainAccess: {
        type: Boolean,
        default: false,
      },
      prioritySupport: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    description: {
      type: String,
      maxlength: [500, 'Description must not exceed 500 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: role + status for filtering active plans
PlanSchema.index({ role: 1, status: 1 });

// Unique constraint: name + role (same plan name can exist for different roles)
PlanSchema.index({ name: 1, role: 1 }, { unique: true });

export const Plan: Model<IPlan> = mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema);

