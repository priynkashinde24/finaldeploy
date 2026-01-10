import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Tracking Event Model
 * 
 * PURPOSE:
 * - Store tracking events for Logistics, Returns, and CRM
 * - Track status changes and location updates
 * - Support courier API sync and manual updates
 * - Provide timeline data for tracking pages
 */

export type TrackingType = 'logistics' | 'returns' | 'crm';

export interface ITrackingEvent extends Document {
  storeId: mongoose.Types.ObjectId;
  trackingType: TrackingType;
  
  // Reference IDs (one per type)
  orderId?: mongoose.Types.ObjectId | null; // For logistics
  rmaId?: mongoose.Types.ObjectId | null; // For returns
  crmTicketId?: string | null; // For CRM
  
  // Tracking details
  status: string; // Current status
  location?: string; // Current location (city, facility, etc.)
  description: string; // Event description
  timestamp: Date; // When the event occurred
  
  // Courier information
  courierId?: mongoose.Types.ObjectId | null;
  awbNumber?: string | null; // Airway Bill Number
  trackingNumber?: string | null; // Alternative tracking number
  
  // Source of update
  source: 'system' | 'courier_api' | 'manual' | 'webhook';
  sourceId?: string | null; // ID from source system
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const TrackingEventSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    trackingType: {
      type: String,
      enum: ['logistics', 'returns', 'crm'],
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    rmaId: {
      type: Schema.Types.ObjectId,
      ref: 'RMA',
      default: null,
      index: true,
    },
    crmTicketId: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    courierId: {
      type: Schema.Types.ObjectId,
      ref: 'Courier',
      default: null,
    },
    awbNumber: {
      type: String,
      trim: true,
      index: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['system', 'courier_api', 'manual', 'webhook'],
      required: true,
      default: 'system',
    },
    sourceId: {
      type: String,
      trim: true,
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

// Indexes
TrackingEventSchema.index({ storeId: 1, trackingType: 1, timestamp: -1 });
TrackingEventSchema.index({ orderId: 1, trackingType: 1, timestamp: -1 });
TrackingEventSchema.index({ rmaId: 1, trackingType: 1, timestamp: -1 });
TrackingEventSchema.index({ crmTicketId: 1, trackingType: 1, timestamp: -1 });
TrackingEventSchema.index({ awbNumber: 1, timestamp: -1 });
TrackingEventSchema.index({ trackingNumber: 1, timestamp: -1 });

export const TrackingEvent: Model<ITrackingEvent> = mongoose.model<ITrackingEvent>(
  'TrackingEvent',
  TrackingEventSchema
);

