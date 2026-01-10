import mongoose, { Schema, Document, Model } from 'mongoose';

export type IPRestrictionScope = 'global' | 'store' | 'user' | 'role';
export type IPRestrictionRuleType = 'allow' | 'deny';

export interface IIPRestriction extends Document {
  storeId: mongoose.Types.ObjectId | null; // null for global rules
  scope: IPRestrictionScope;
  scopeId: string | mongoose.Types.ObjectId | null; // userId / role / storeId
  ruleType: IPRestrictionRuleType;
  ipRange: string; // Single IP or CIDR
  status: 'active' | 'inactive';
  description?: string;
  createdBy: mongoose.Types.ObjectId | null; // admin user
  createdAt: Date;
  updatedAt: Date;
}

const IPRestrictionSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    scope: {
      type: String,
      enum: ['global', 'store', 'user', 'role'],
      required: true,
      index: true,
    },
    scopeId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    ruleType: {
      type: String,
      enum: ['allow', 'deny'],
      required: true,
      index: true,
    },
    ipRange: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
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

// Indexes
IPRestrictionSchema.index({ storeId: 1, scope: 1, scopeId: 1, status: 1 });
IPRestrictionSchema.index({ scope: 1, status: 1, ruleType: 1 });
IPRestrictionSchema.index({ ruleType: 1, status: 1 });

export const IPRestriction: Model<IIPRestriction> =
  mongoose.models.IPRestriction || mongoose.model<IIPRestriction>('IPRestriction', IPRestrictionSchema);


