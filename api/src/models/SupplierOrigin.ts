import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Supplier Origin (Warehouse) Model
 * 
 * PURPOSE:
 * - Store supplier warehouse/origin locations
 * - Support multiple warehouses per supplier
 * - Enable multi-origin fulfillment routing
 * 
 * RULES:
 * - One supplier can have multiple origins
 * - Only active origins used for routing
 * - Geographic coordinates for distance calculation
 */

export interface ISupplierOrigin extends Document {
  supplierId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  name: string; // e.g., "Mumbai Warehouse", "Delhi Fulfillment Center"
  address: {
    country: string;
    state: string;
    city: string;
    pincode: string;
    street?: string;
  };
  geo: {
    lat: number; // Latitude
    lng: number; // Longitude
  };
  supportedCouriers: mongoose.Types.ObjectId[]; // Courier IDs that can service this origin
  isActive: boolean;
  priority?: number; // Lower = higher priority (for routing)
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierOriginSchema: Schema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier ID is required'],
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Origin name is required'],
      trim: true,
    },
    address: {
      country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
      },
      state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
      },
      pincode: {
        type: String,
        required: [true, 'Pincode is required'],
        trim: true,
        index: true,
      },
      street: {
        type: String,
        trim: true,
      },
    },
    geo: {
      lat: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      lng: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
    },
    supportedCouriers: {
      type: [Schema.Types.ObjectId],
      ref: 'Courier',
      default: [],
    },
    priority: {
      type: Number,
      min: [1, 'Priority must be at least 1'],
      default: 999, // Lower = higher priority
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// Compound indexes
SupplierOriginSchema.index({ supplierId: 1, isActive: 1 });
SupplierOriginSchema.index({ storeId: 1, supplierId: 1, isActive: 1 });
SupplierOriginSchema.index({ 'address.pincode': 1, isActive: 1 });
SupplierOriginSchema.index({ 'geo.lat': 1, 'geo.lng': 1 }); // For geospatial queries

export const SupplierOrigin: Model<ISupplierOrigin> =
  mongoose.models.SupplierOrigin ||
  mongoose.model<ISupplierOrigin>('SupplierOrigin', SupplierOriginSchema);

