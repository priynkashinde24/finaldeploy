import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Margin Alert Model
 * 
 * PURPOSE:
 * - Detect margin risks automatically
 * - Alert Admin & Resellers in real-time or scheduled
 * - Never auto-change prices
 * - Act as early-warning system
 * 
 * RULES:
 * - Alerts are immutable records
 * - Same alert type not duplicated within cooldown window
 * - Alerts never block checkout
 * - Alerts never auto-fix prices
 * - Admin decision required to resolve
 */

export interface IMarginAlert extends Document {
  alertType: 'below_min_markup' | 'near_min_markup' | 'abnormally_high_markup' | 'sudden_margin_drop';
  scope: 'variant' | 'product' | 'brand' | 'reseller';
  scopeId?: mongoose.Types.ObjectId | string | null; // Variant ID, Product ID, Brand ID, or null for reseller scope
  resellerId?: mongoose.Types.ObjectId | string | null; // Reseller ID (optional, for reseller-specific alerts)
  currentMargin: number; // Current margin (₹)
  currentMarginPercent: number; // Current margin percentage
  expectedMinMargin: number; // Expected minimum margin from markup rule (₹)
  expectedMinMarginPercent: number; // Expected minimum margin percentage
  deviationPercentage: number; // How far off from expected (positive = above, negative = below)
  severity: 'low' | 'medium' | 'high';
  message: string; // Human-readable alert message
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledgedBy?: mongoose.Types.ObjectId | null; // Admin who acknowledged
  acknowledgedAt?: Date | null;
  resolvedBy?: mongoose.Types.ObjectId | null; // Admin who resolved
  resolvedAt?: Date | null;
  metadata?: {
    sellingPrice?: number;
    supplierCost?: number;
    historicalAverage?: number;
    daysSinceLastCheck?: number;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MarginAlertSchema: Schema = new Schema(
  {
    alertType: {
      type: String,
      enum: ['below_min_markup', 'near_min_markup', 'abnormally_high_markup', 'sudden_margin_drop'],
      required: [true, 'Alert type is required'],
      index: true,
    },
    scope: {
      type: String,
      enum: ['variant', 'product', 'brand', 'reseller'],
      required: [true, 'Scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
      default: null,
      index: true,
      // Variant ID for variant scope
      // Product ID for product scope
      // Brand ID for brand scope
      // null for reseller scope
    },
    resellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      // Reseller ID for reseller-specific alerts
    },
    currentMargin: {
      type: Number,
      required: [true, 'Current margin is required'],
    },
    currentMarginPercent: {
      type: Number,
      required: [true, 'Current margin percentage is required'],
    },
    expectedMinMargin: {
      type: Number,
      required: [true, 'Expected minimum margin is required'],
    },
    expectedMinMarginPercent: {
      type: Number,
      required: [true, 'Expected minimum margin percentage is required'],
    },
    deviationPercentage: {
      type: Number,
      required: [true, 'Deviation percentage is required'],
      // Positive = above expected, negative = below expected
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: [true, 'Severity is required'],
      index: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [500, 'Message must not exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved'],
      default: 'open',
      index: true,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      // Additional context: sellingPrice, supplierCost, historicalAverage, etc.
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
MarginAlertSchema.index({ status: 1, severity: 1, createdAt: -1 }); // Get open alerts by severity
MarginAlertSchema.index({ resellerId: 1, status: 1, createdAt: -1 }); // Get reseller alerts
MarginAlertSchema.index({ scope: 1, scopeId: 1, alertType: 1, status: 1 }); // Prevent duplicates
MarginAlertSchema.index({ alertType: 1, scope: 1, scopeId: 1, resellerId: 1, createdAt: -1 }); // Cooldown check

// Pre-save hook: Validate scopeId based on scope
MarginAlertSchema.pre('save', function (next) {
  if (this.scope === 'reseller' && this.scopeId !== null) {
    return next(new Error('Reseller scope must have scopeId as null'));
  }
  if (this.scope !== 'reseller' && !this.scopeId) {
    return next(new Error(`${this.scope} scope must have a scopeId`));
  }
  next();
});

export const MarginAlert: Model<IMarginAlert> =
  mongoose.models.MarginAlert || mongoose.model<IMarginAlert>('MarginAlert', MarginAlertSchema);

