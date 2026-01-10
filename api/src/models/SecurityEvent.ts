import mongoose, { Schema, Document, Model } from 'mongoose';

export type SecurityEventType =
  | 'IP_BLOCKED'
  | 'LOGIN_FAILED'
  | 'LOGIN_SUCCESS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'PASSWORD_RESET_REQUEST'
  | 'TOKEN_REFRESH';

export interface ISecurityEvent extends Document {
  storeId: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId | null;
  eventType: SecurityEventType;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

const SecurityEventSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'IP_BLOCKED',
        'LOGIN_FAILED',
        'LOGIN_SUCCESS',
        'RATE_LIMIT_EXCEEDED',
        'SUSPICIOUS_ACTIVITY',
        'PASSWORD_RESET_REQUEST',
        'TOKEN_REFRESH',
      ],
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    endpoint: {
      type: String,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SecurityEventSchema.index({ storeId: 1, eventType: 1, createdAt: -1 });
SecurityEventSchema.index({ storeId: 1, severity: 1, createdAt: -1 });
SecurityEventSchema.index({ ipAddress: 1, createdAt: -1 });
SecurityEventSchema.index({ createdAt: -1 });

export const SecurityEvent: Model<ISecurityEvent> =
  mongoose.models.SecurityEvent || mongoose.model<ISecurityEvent>('SecurityEvent', SecurityEventSchema);


