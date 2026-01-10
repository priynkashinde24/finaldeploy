import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Fulfillment Route Model
 * 
 * PURPOSE:
 * - Store fulfillment routing decisions for Logistics, Returns, and CRM
 * - Track origin assignments and routing scores
 * - Support multi-origin routing
 * - Provide audit trail for routing decisions
 */

export type FulfillmentRouteType = 'logistics' | 'returns' | 'crm';

export interface IFulfillmentRouteItem {
  globalVariantId: mongoose.Types.ObjectId | string;
  quantity: number;
  supplierId: mongoose.Types.ObjectId | string;
  originId: mongoose.Types.ObjectId | string;
  originName: string;
  routingScore: number; // Lower = better
  shippingCost?: number;
  courierId?: mongoose.Types.ObjectId | string;
  shippingZoneId?: mongoose.Types.ObjectId | string;
}

export interface IFulfillmentRoute extends Document {
  storeId: mongoose.Types.ObjectId;
  routeType: FulfillmentRouteType;
  
  // Reference IDs (one per type)
  orderId?: mongoose.Types.ObjectId | null; // For logistics
  rmaId?: mongoose.Types.ObjectId | null; // For returns
  crmTicketId?: string | null; // For CRM
  
  // Routing details
  items: IFulfillmentRouteItem[];
  shipmentGroups: Array<{
    originId: mongoose.Types.ObjectId | string;
    originName: string;
    items: Array<{
      globalVariantId: mongoose.Types.ObjectId | string;
      quantity: number;
    }>;
    shippingCost: number;
    courierId?: mongoose.Types.ObjectId | string;
    shippingZoneId?: mongoose.Types.ObjectId | string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  }>;
  
  // Routing metadata
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  totalShippingCost: number;
  routingStrategy: 'cost' | 'speed' | 'distance' | 'priority' | 'balanced';
  routingScore: number; // Overall routing score
  
  // Status
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const FulfillmentRouteItemSchema: Schema = new Schema(
  {
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierOrigin',
      required: true,
    },
    originName: {
      type: String,
      required: true,
    },
    routingScore: {
      type: Number,
      required: true,
    },
    shippingCost: {
      type: Number,
      min: 0,
    },
    courierId: {
      type: Schema.Types.ObjectId,
      ref: 'Courier',
    },
    shippingZoneId: {
      type: Schema.Types.ObjectId,
      ref: 'ShippingZone',
    },
  },
  { _id: false }
);

const ShipmentGroupSchema: Schema = new Schema(
  {
    originId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierOrigin',
      required: true,
    },
    originName: {
      type: String,
      required: true,
    },
    items: [
      {
        globalVariantId: {
          type: Schema.Types.ObjectId,
          ref: 'ProductVariant',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    shippingCost: {
      type: Number,
      required: true,
      min: 0,
    },
    courierId: {
      type: Schema.Types.ObjectId,
      ref: 'Courier',
    },
    shippingZoneId: {
      type: Schema.Types.ObjectId,
      ref: 'ShippingZone',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
  },
  { _id: false }
);

const DeliveryAddressSchema: Schema = new Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const FulfillmentRouteSchema: Schema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    routeType: {
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
    items: {
      type: [FulfillmentRouteItemSchema],
      required: true,
    },
    shipmentGroups: {
      type: [ShipmentGroupSchema],
      required: true,
    },
    deliveryAddress: {
      type: DeliveryAddressSchema,
      required: true,
    },
    totalShippingCost: {
      type: Number,
      required: true,
      min: 0,
    },
    routingStrategy: {
      type: String,
      enum: ['cost', 'speed', 'distance', 'priority', 'balanced'],
      default: 'balanced',
    },
    routingScore: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
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
FulfillmentRouteSchema.index({ storeId: 1, routeType: 1, status: 1 });
FulfillmentRouteSchema.index({ orderId: 1, routeType: 1 });
FulfillmentRouteSchema.index({ rmaId: 1, routeType: 1 });
FulfillmentRouteSchema.index({ crmTicketId: 1, routeType: 1 });
FulfillmentRouteSchema.index({ 'shipmentGroups.originId': 1 });

export const FulfillmentRoute: Model<IFulfillmentRoute> = mongoose.model<IFulfillmentRoute>(
  'FulfillmentRoute',
  FulfillmentRouteSchema
);

