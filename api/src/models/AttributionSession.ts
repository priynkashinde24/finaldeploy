import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Attribution Session Model
 * 
 * PURPOSE:
 * - Link marketing touches together within a session
 * - Track first-touch and last-touch for attribution
 * - Support multi-touch attribution models
 * 
 * RULES:
 * - Session timeout configurable (default: 30 minutes)
 * - Session links all touches together
 * - Can be extended if user returns within timeout
 */

export interface IAttributionSession extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  sessionId: string; // Unique session identifier
  userId?: mongoose.Types.ObjectId | string | null; // User ID if known

  // Touch references
  firstTouchId: mongoose.Types.ObjectId; // First marketing touch
  lastTouchId: mongoose.Types.ObjectId; // Last marketing touch
  allTouchIds: mongoose.Types.ObjectId[]; // All touches in session

  // Session timing
  startedAt: Date; // First touch time
  endedAt?: Date; // Last touch time (updated on each new touch)
  lastActivityAt: Date; // Last activity timestamp

  // Session metadata
  touchCount: number; // Number of touches in session
  isActive: boolean; // Whether session is still active

  createdAt: Date;
  updatedAt: Date;
}

const AttributionSessionSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    firstTouchId: {
      type: Schema.Types.ObjectId,
      ref: 'MarketingTouch',
      required: [true, 'First touch ID is required'],
      index: true,
    },
    lastTouchId: {
      type: Schema.Types.ObjectId,
      ref: 'MarketingTouch',
      required: [true, 'Last touch ID is required'],
      index: true,
    },
    allTouchIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'MarketingTouch' }],
      default: [],
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    touchCount: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
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
AttributionSessionSchema.index({ storeId: 1, sessionId: 1 }, { unique: true });
AttributionSessionSchema.index({ storeId: 1, userId: 1, startedAt: -1 });
AttributionSessionSchema.index({ storeId: 1, isActive: 1, lastActivityAt: -1 });
AttributionSessionSchema.index({ firstTouchId: 1 });
AttributionSessionSchema.index({ lastTouchId: 1 });

export const AttributionSession: Model<IAttributionSession> =
  mongoose.models.AttributionSession || mongoose.model<IAttributionSession>('AttributionSession', AttributionSessionSchema);

