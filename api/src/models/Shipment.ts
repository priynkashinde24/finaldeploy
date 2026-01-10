import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IShipment extends Document {
  orderId: string;
  supplierId: string;
  courier: string;
  trackingNumber: string;
  labelUrl: string;
  rate: number;
  status: 'created' | 'shipped' | 'delivered';
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentSchema: Schema = new Schema(
  {
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      trim: true,
      index: true,
    },
    supplierId: {
      type: String,
      required: [true, 'Supplier ID is required'],
      trim: true,
      index: true,
    },
    courier: {
      type: String,
      required: [true, 'Courier is required'],
      trim: true,
      enum: ['standard', 'express', 'fedex', 'ups', 'usps'],
      default: 'standard',
    },
    trackingNumber: {
      type: String,
      required: [true, 'Tracking number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    labelUrl: {
      type: String,
      required: [true, 'Label URL is required'],
      trim: true,
    },
    rate: {
      type: Number,
      required: [true, 'Rate is required'],
      min: [0, 'Rate must be greater than or equal to 0'],
    },
    status: {
      type: String,
      enum: ['created', 'shipped', 'delivered'],
      default: 'created',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
ShipmentSchema.index({ orderId: 1, status: 1 });
ShipmentSchema.index({ supplierId: 1, status: 1 });

export const Shipment: Model<IShipment> =
  mongoose.models.Shipment || mongoose.model<IShipment>('Shipment', ShipmentSchema);

