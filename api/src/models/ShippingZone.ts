import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Shipping Zone Model
 * 
 * PURPOSE:
 * - Define shipping zones per store
 * - Support zone resolution by pincode → state → country
 * - Store-specific zones
 * 
 * RULES:
 * - Zones are store-specific
 * - Zone resolution priority: pincode → state → country
 * - One zone can match multiple criteria
 */

export interface IShippingZone extends Document {
  storeId: mongoose.Types.ObjectId;
  name: string; // e.g. "Local", "Zone A", "Zone B"
  countryCode: string; // ISO country code (IN, US, etc.)
  stateCodes?: string[]; // Optional: state codes (e.g., ["MH", "GJ"])
  pincodes?: string[]; // Optional: pincodes/postal codes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShippingZoneSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Zone name is required'],
      trim: true,
    },
    countryCode: {
      type: String,
      required: [true, 'Country code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    stateCodes: {
      type: [String],
      default: [],
      // Optional: state codes (e.g., ["MH", "GJ"])
    },
    pincodes: {
      type: [String],
      default: [],
      // Optional: pincodes/postal codes
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

// Compound indexes for efficient zone resolution
ShippingZoneSchema.index({ storeId: 1, isActive: 1 });
ShippingZoneSchema.index({ storeId: 1, countryCode: 1, isActive: 1 });
ShippingZoneSchema.index({ storeId: 1, 'stateCodes': 1, isActive: 1 });
ShippingZoneSchema.index({ storeId: 1, 'pincodes': 1, isActive: 1 });

// Ensure unique zone names per store
ShippingZoneSchema.index({ storeId: 1, name: 1 }, { unique: true });

export const ShippingZone: Model<IShippingZone> =
  mongoose.models.ShippingZone || mongoose.model<IShippingZone>('ShippingZone', ShippingZoneSchema);

