import { Request, Response, NextFunction } from 'express';
import { Shipment } from '../models/Shipment';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { calculateShippingRate, getRateByService } from '../services/shippingService';
import { generateShippingLabel } from '../utils/labelGenerator';
import { z } from 'zod';
import * as path from 'path';

// Validation schemas
const createLabelSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  courier: z.enum(['standard', 'express', 'fedex', 'ups', 'usps']).default('standard'),
});

/**
 * Create shipping label
 * POST /api/shipping/create-label
 */
export const createLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = createLabelSchema.parse(req.body);
    const { orderId, courier } = validatedData;

    // Find order
    const order = await Order.findOne({ orderId });
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Check if shipment already exists
    const existingShipment = await Shipment.findOne({ orderId });
    if (existingShipment) {
      sendError(res, 'Shipping label already exists for this order', 400);
      return;
    }

    // Get supplier ID from order items (assuming single supplier for now)
    const supplierId = order.items[0]?.supplierId;
    if (!supplierId) {
      sendError(res, 'Unable to determine supplier for order', 400);
      return;
    }

    // Calculate shipping rate
    // Estimate weight: 1 lb per item (stub)
    const estimatedWeight = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const destination = order.shippingAddress
      ? {
          zip: order.shippingAddress.zip,
          country: order.shippingAddress.country,
        }
      : { zip: '00000', country: 'US' };

    const rate = getRateByService(
      {
        weight: estimatedWeight,
        destination,
      },
      courier === 'fedex' || courier === 'ups' || courier === 'usps' ? 'standard' : courier
    );

    // Generate tracking number
    const trackingNumber = `TRK${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Get supplier name (stub - in production, fetch from Supplier model)
    const supplierName = `Supplier ${String(supplierId).substring(0, 8)}`;

    // Prepare label data
    const labelData = {
      orderId,
      supplierName,
      customerName: order.customerName || 'Customer',
      customerAddress: order.shippingAddress || {
        street: 'N/A',
        city: 'N/A',
        state: 'N/A',
        zip: '00000',
        country: 'US',
      },
      trackingNumber,
      courier,
    };

    // Generate PDF label
    const labelsDir = path.join(process.cwd(), 'public', 'labels');
    const fileName = `${trackingNumber}.pdf`;
    const filePath = path.join(labelsDir, fileName);

    await generateShippingLabel(labelData, filePath);

    // Generate label URL
    const labelUrl = `/labels/${fileName}`;

    // Create shipment record
    const shipment = new Shipment({
      orderId,
      supplierId,
      courier,
      trackingNumber,
      labelUrl,
      rate,
      status: 'created',
    });

    await shipment.save();

    sendSuccess(
      res,
      {
        shipmentId: shipment._id,
        orderId,
        trackingNumber,
        labelUrl,
        rate,
        courier,
        status: shipment.status,
      },
      'Shipping label created successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get shipping details by order ID
 * GET /api/shipping/:orderId
 */
export const getShippingByOrderId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const shipment = await Shipment.findOne({ orderId });

    if (!shipment) {
      sendError(res, 'Shipping not found for this order', 404);
      return;
    }

    sendSuccess(res, shipment, 'Shipping details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get shipping rates for an order
 * GET /api/shipping/rates/:orderId
 */
export const getShippingRates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Estimate weight: 1 lb per item (stub)
    const estimatedWeight = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const destination = order.shippingAddress
      ? {
          zip: order.shippingAddress.zip,
          country: order.shippingAddress.country,
        }
      : { zip: '00000', country: 'US' };

    const rates = calculateShippingRate({
      weight: estimatedWeight,
      destination,
    });

    sendSuccess(res, { orderId, rates }, 'Shipping rates retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all shipments (admin)
 * GET /api/shipping
 */
export const getAllShipments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { supplierId, status, courier } = req.query;

    const filter: any = {};
    if (supplierId) filter.supplierId = supplierId;
    if (status) filter.status = status;
    if (courier) filter.courier = courier;

    const shipments = await Shipment.find(filter).sort({ createdAt: -1 }).limit(1000);

    sendSuccess(res, shipments, 'Shipments retrieved successfully');
  } catch (error) {
    next(error);
  }
};

