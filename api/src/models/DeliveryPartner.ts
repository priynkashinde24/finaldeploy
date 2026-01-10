import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Delivery Partner Model
 * 
 * PURPOSE:
 * - Track delivery partners (e.g., FedEx, UPS, local couriers)
 * - Store webhook credentials
 * - Track delivery status updates
 */

export interface IDeliveryPartner extends Document {
  name: string;
  code: string; // Unique partner code (e.g., 'fedex', 'ups', 'local')
  webhookUrl?: string; // Our webhook endpoint for this partner
  apiKey?: string; // API key for webhook verification
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryPartnerSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Partner name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Partner code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    webhookUrl: {
      type: String,
      trim: true,
    },
    apiKey: {
      type: String,
      trim: true,
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

export const DeliveryPartner: Model<IDeliveryPartner> = mongoose.model<IDeliveryPartner>(
  'DeliveryPartner',
  DeliveryPartnerSchema
);

