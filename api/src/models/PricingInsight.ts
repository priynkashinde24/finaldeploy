import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Pricing Insight Model
 * 
 * PURPOSE:
 * - Store AI-generated pricing suggestions
 * - Advisory only - never auto-applies
 * - Provides explainable recommendations
 * - Tracks confidence and reasoning
 * 
 * RULES:
 * - Read-only insights (never overwrite real prices)
 * - Insights expire after X days (configurable)
 * - One active insight per scope + scopeId
 * - Confidence score required (0-100)
 */

export interface IPricingInsight extends Document {
  scope: 'product' | 'variant';
  scopeId: mongoose.Types.ObjectId; // Product ID or Variant ID
  currentPrice: number; // Current selling price at time of insight
  suggestedPrice: number; // AI-suggested price
  suggestionReason: string; // Human-readable explanation
  confidenceScore: number; // 0-100, how confident the suggestion is
  metricsSnapshot: {
    avgDailyOrders: number; // Average daily orders (last 7/30 days)
    stockLevel: number; // Current stock level
    stockVelocity: number; // Stock ÷ avg sales (days of stock remaining)
    avgMargin: number; // Average margin percentage
    priceElasticityScore: number; // Price sensitivity score (0-100)
    conversionRate?: number; // Conversion rate if available
    competitorPrice?: number; // Competitor price if available
  };
  expectedImpact: {
    salesChange: 'increase' | 'decrease' | 'neutral'; // Expected sales direction
    marginChange: 'increase' | 'decrease' | 'neutral'; // Expected margin direction
    estimatedSalesChangePercent?: number; // Estimated % change in sales
    estimatedMarginChangePercent?: number; // Estimated % change in margin
  };
  adminConstraints: {
    minPrice: number | null; // Admin min price limit
    maxPrice: number | null; // Admin max price limit
    withinLimits: boolean; // Whether suggestion respects limits
  };
  expiresAt: Date; // When this insight expires (default: 7 days)
  createdAt: Date;
  updatedAt: Date;
}

const PricingInsightSchema: Schema = new Schema(
  {
    scope: {
      type: String,
      enum: ['product', 'variant'],
      required: [true, 'Scope is required'],
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Scope ID is required'],
      index: true,
    },
    currentPrice: {
      type: Number,
      required: [true, 'Current price is required'],
      min: [0, 'Current price must be non-negative'],
    },
    suggestedPrice: {
      type: Number,
      required: [true, 'Suggested price is required'],
      min: [0, 'Suggested price must be non-negative'],
    },
    suggestionReason: {
      type: String,
      required: [true, 'Suggestion reason is required'],
      maxlength: [1000, 'Suggestion reason must not exceed 1000 characters'],
    },
    confidenceScore: {
      type: Number,
      required: [true, 'Confidence score is required'],
      min: [0, 'Confidence score must be between 0 and 100'],
      max: [100, 'Confidence score must be between 0 and 100'],
    },
    metricsSnapshot: {
      avgDailyOrders: {
        type: Number,
        required: true,
        min: 0,
      },
      stockLevel: {
        type: Number,
        required: true,
        min: 0,
      },
      stockVelocity: {
        type: Number,
        required: true,
        min: 0,
        // Days of stock remaining at current sales rate
      },
      avgMargin: {
        type: Number,
        required: true,
        // Margin percentage
      },
      priceElasticityScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        // Price sensitivity: 0 = inelastic, 100 = very elastic
      },
      conversionRate: {
        type: Number,
        min: 0,
        max: 100,
        // Conversion rate percentage (optional)
      },
      competitorPrice: {
        type: Number,
        min: 0,
        // Competitor price if available (optional)
      },
    },
    expectedImpact: {
      salesChange: {
        type: String,
        enum: ['increase', 'decrease', 'neutral'],
        required: true,
      },
      marginChange: {
        type: String,
        enum: ['increase', 'decrease', 'neutral'],
        required: true,
      },
      estimatedSalesChangePercent: {
        type: Number,
        // Estimated % change in sales volume
      },
      estimatedMarginChangePercent: {
        type: Number,
        // Estimated % change in margin
      },
    },
    adminConstraints: {
      minPrice: {
        type: Number,
        default: null,
      },
      maxPrice: {
        type: Number,
        default: null,
      },
      withinLimits: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      // Default: 7 days from creation
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: One active insight per scope + scopeId
// Active = not expired
PricingInsightSchema.index(
  { scope: 1, scopeId: 1, expiresAt: 1 },
  { unique: false } // Allow multiple insights, but we'll query for non-expired ones
);

// Index for finding non-expired insights
PricingInsightSchema.index({ expiresAt: 1, createdAt: -1 });

// Index for scope queries
PricingInsightSchema.index({ scope: 1, scopeId: 1, createdAt: -1 });

export const PricingInsight: Model<IPricingInsight> =
  mongoose.models.PricingInsight || mongoose.model<IPricingInsight>('PricingInsight', PricingInsightSchema);

