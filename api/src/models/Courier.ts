import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Courier Master Model
 * 
 * PURPOSE:
 * - Store courier master data per store
 * - Define courier capabilities (COD, weight limits, zones)
 * - Support priority-based selection
 * 
 * RULES:
 * - Couriers are store-specific
 * - Disabled courier never assigned
 * - Code must be unique per store
 */

export interface ICourier extends Document {
  storeId: mongoose.Types.ObjectId;
  name: string; // e.g. "Delhivery", "Shiprocket", "BlueDart"
  code: string; // Unique code per store (e.g. "DEL", "SR", "BD")
  supportsCOD: boolean; // Whether courier supports COD
  maxWeight: number; // Maximum weight in kg (0 = no limit)
  serviceableZones: mongoose.Types.ObjectId[]; // Zone IDs this courier can service
  serviceablePincodes?: string[]; // Optional: specific pincodes
  priority: number; // Lower = higher priority (1 = highest)
  trackingUrlTemplate?: string; // Template for tracking URL (e.g., "https://track.delhivery.com/{{awb}}")
  apiConfig?: {
    provider: 'shiprocket' | 'delhivery' | 'manual';
    apiKey?: string;
    apiSecret?: string;
    webhookSecret?: string;
    baseUrl?: string;
    enabled: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourierSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Courier name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Courier code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    supportsCOD: {
      type: Boolean,
      default: false,
      index: true,
    },
    maxWeight: {
      type: Number,
      required: [true, 'Max weight is required'],
      min: [0, 'Max weight must be non-negative'],
      default: 0, // 0 = no limit
    },
    serviceableZones: {
      type: [Schema.Types.ObjectId],
      ref: 'ShippingZone',
      default: [],
      required: true,
    },
    serviceablePincodes: {
      type: [String],
      default: [],
      // Optional: specific pincodes
    },
    priority: {
      type: Number,
      required: [true, 'Priority is required'],
      min: [1, 'Priority must be at least 1'],
      default: 999, // Lower = higher priority
    },
    trackingUrlTemplate: {
      type: String,
      trim: true,
      // Template for tracking URL (e.g., "https://track.delhivery.com/{{awb}}")
    },
    apiConfig: {
      provider: {
        type: String,
        enum: ['shiprocket', 'delhivery', 'manual'],
        default: 'manual',
      },
      apiKey: {
        type: String,
        trim: true,
      },
      apiSecret: {
        type: String,
        trim: true,
      },
      webhookSecret: {
        type: String,
        trim: true,
      },
      baseUrl: {
        type: String,
        trim: true,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
CourierSchema.index({ storeId: 1, code: 1 }, { unique: true }); // Unique code per store
CourierSchema.index({ storeId: 1, isActive: 1, priority: 1 });
CourierSchema.index({ storeId: 1, 'serviceableZones': 1, isActive: 1 });

export const Courier: Model<ICourier> =
  mongoose.models.Courier || mongoose.model<ICourier>('Courier', CourierSchema);

