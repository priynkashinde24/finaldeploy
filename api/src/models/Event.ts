import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvent extends Document {
  eventType: string;
  payload: Record<string, any>;
  storeId?: string;
  userId?: string;
  occurredAt: Date;
  createdAt: Date;
}

const EventSchema: Schema = new Schema(
  {
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: [true, 'Event payload is required'],
      default: {},
    },
    storeId: {
      type: String,
      trim: true,
      index: true,
    },
    userId: {
      type: String,
      trim: true,
      index: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
EventSchema.index({ storeId: 1, eventType: 1 });
EventSchema.index({ storeId: 1, occurredAt: -1 });
EventSchema.index({ eventType: 1, occurredAt: -1 });

export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

