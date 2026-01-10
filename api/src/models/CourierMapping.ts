import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Courier Mapping Model
 * 
 * PURPOSE:
 * - Define courier mappings for different scenarios
 * - Support Logistics (outbound), Returns (reverse), CRM (customer service)
 * - Store mapping rules and configurations
 * - Enable scenario-specific courier selection
 */

export type CourierMappingType = 'logistics' | 'returns' | 'crm';
export type CourierMappingPriority = 'cost' | 'speed' | 'reliability' | 'coverage' | 'custom';

export interface ICourierMapping extends Document {
  storeId: mongoose.Types.ObjectId;
  mappingType: CourierMappingType; // logistics, returns, crm
  name: string; // Mapping rule name
  description?: string;
  
  // Courier assignment
  courierId: mongoose.Types.ObjectId; // Primary courier
  fallbackCourierId?: mongoose.Types.ObjectId; // Fallback courier
  
  // Scenario-specific filters
  // For Logistics
  shippingZoneId?: mongoose.Types.ObjectId; // Zone for logistics
  paymentMethod?: 'prepaid' | 'cod' | 'both'; // Payment method filter
  minWeight?: number; // Min weight in kg
  maxWeight?: number; // Max weight in kg
  minOrderValue?: number; // Min order value
  maxOrderValue?: number; // Max order value
  
  // For Returns
  returnReason?: string[]; // Return reasons (e.g., 'defective', 'wrong_item')
  itemCondition?: 'sealed' | 'opened' | 'damaged' | 'all'; // Item condition
  returnValue?: number; // Return order value threshold
  supportsPickup?: boolean; // Whether courier supports pickup
  
  // For CRM
  crmScenario?: 'support_ticket' | 'document_delivery' | 'replacement' | 'warranty' | 'all';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  customerTier?: 'standard' | 'premium' | 'vip' | 'all';
  
  // Priority and selection
  priority: number; // Lower = higher priority
  selectionPriority: CourierMappingPriority; // Cost, speed, reliability, etc.
  customScore?: number; // Custom scoring for selection
  
  // Conditions
  conditions?: {
    timeOfDay?: string[]; // e.g., ['09:00-17:00']
    dayOfWeek?: string[]; // e.g., ['monday', 'tuesday']
    season?: string[]; // e.g., ['festival', 'normal']
    specialEvent?: boolean; // Special event handling
  };
  
  // Status
  isActive: boolean;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const CourierMappingSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    mappingType: {
      type: String,
      enum: ['logistics', 'returns', 'crm'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    courierId: {
      type: Schema.Types.ObjectId,
      ref: 'Courier',
      required: true,
      index: true,
    },
    fallbackCourierId: {
      type: Schema.Types.ObjectId,
      ref: 'Courier',
      default: null,
    },
    // Logistics filters
    shippingZoneId: {
      type: Schema.Types.ObjectId,
      ref: 'ShippingZone',
      default: null,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['prepaid', 'cod', 'both'],
      default: null,
    },
    minWeight: {
      type: Number,
      min: 0,
      default: null,
    },
    maxWeight: {
      type: Number,
      min: 0,
      default: null,
    },
    minOrderValue: {
      type: Number,
      min: 0,
      default: null,
    },
    maxOrderValue: {
      type: Number,
      min: 0,
      default: null,
    },
    // Returns filters
    returnReason: {
      type: [String],
      default: [],
    },
    itemCondition: {
      type: String,
      enum: ['sealed', 'opened', 'damaged', 'all'],
      default: null,
    },
    returnValue: {
      type: Number,
      min: 0,
      default: null,
    },
    supportsPickup: {
      type: Boolean,
      default: null,
    },
    // CRM filters
    crmScenario: {
      type: String,
      enum: ['support_ticket', 'document_delivery', 'replacement', 'warranty', 'all'],
      default: null,
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: null,
    },
    customerTier: {
      type: String,
      enum: ['standard', 'premium', 'vip', 'all'],
      default: null,
    },
    // Priority
    priority: {
      type: Number,
      required: true,
      min: 1,
      default: 999,
      index: true,
    },
    selectionPriority: {
      type: String,
      enum: ['cost', 'speed', 'reliability', 'coverage', 'custom'],
      default: 'cost',
    },
    customScore: {
      type: Number,
      default: null,
    },
    // Conditions
    conditions: {
      timeOfDay: {
        type: [String],
        default: [],
      },
      dayOfWeek: {
        type: [String],
        default: [],
      },
      season: {
        type: [String],
        default: [],
      },
      specialEvent: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      required: true,
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

// Indexes
CourierMappingSchema.index({ storeId: 1, mappingType: 1, isActive: 1, priority: 1 });
CourierMappingSchema.index({ storeId: 1, mappingType: 1, shippingZoneId: 1, isActive: 1 });
CourierMappingSchema.index({ courierId: 1, mappingType: 1, isActive: 1 });
CourierMappingSchema.index({ mappingType: 1, crmScenario: 1, isActive: 1 });

export const CourierMapping: Model<ICourierMapping> = mongoose.model<ICourierMapping>(
  'CourierMapping',
  CourierMappingSchema
);

