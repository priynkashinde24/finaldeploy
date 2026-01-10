import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { Order, IOrder } from '../models/Order';
import { ShippingLabel, IShippingLabel } from '../models/ShippingLabel';
import { Store } from '../models/Store';
import { TaxProfile } from '../models/TaxProfile';
import { User } from '../models/User';
import { generateLabelNumber } from '../utils/labelNumber';
import { generateShippingLabelPdf, ShippingLabelPdfData } from '../utils/shippingLabelPdf';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';

/**
 * Shipping Label Generation Service
 * 
 * PURPOSE:
 * - Generate printable shipping labels (PDF)
 * - Include courier, address, order, barcode info
 * - Freeze label once generated
 * - Support manual & API-based couriers
 * - Integrate with order lifecycle
 * 
 * RULES:
 * - Label can be generated only when orderStatus = processing OR confirmed
 * - orderStatus = shipped requires label
 * - One active label per order
 * - Label immutable after generation
 */

export interface GenerateShippingLabelParams {
  orderId: mongoose.Types.ObjectId | string;
  generatedBy: mongoose.Types.ObjectId | string;
  req?: Request; // For audit logging
}

export interface GenerateShippingLabelResult {
  success: boolean;
  label?: IShippingLabel;
  error?: string;
}

/**
 * Generate shipping label for an order
 * 
 * Flow:
 * 1. Fetch order
 * 2. Validate orderStatus >= processing
 * 3. Validate courier assigned
 * 4. Validate no existing label
 * 5. Generate labelNumber
 * 6. Build label data
 * 7. Generate PDF
 * 8. Save ShippingLabel record
 * 9. Emit LABEL_GENERATED event
 */
export async function generateShippingLabel(
  params: GenerateShippingLabelParams
): Promise<GenerateShippingLabelResult> {
  const { orderId, generatedBy, req } = params;

  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;
  const userObjId = typeof generatedBy === 'string' ? new mongoose.Types.ObjectId(generatedBy) : generatedBy;

  try {
    return await withTransaction(async (session: ClientSession) => {
      // Step 1: Fetch order
      const order = await Order.findById(orderObjId).session(session);
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
        };
      }

      // Step 2: Validate orderStatus >= processing
      const validStatuses = ['confirmed', 'processing'];
      if (!validStatuses.includes(order.orderStatus)) {
        return {
          success: false,
          error: `Label can only be generated when order status is 'confirmed' or 'processing'. Current status: ${order.orderStatus}`,
        };
      }

      // Step 3: Validate courier assigned
      if (!order.courierSnapshot) {
        return {
          success: false,
          error: 'Courier must be assigned before generating shipping label',
        };
      }

      // Step 4: Validate no existing active label
      const existingLabel = await ShippingLabel.findOne({
        orderId: orderObjId,
        status: 'generated',
      }).session(session);

      if (existingLabel) {
        return {
          success: false,
          error: 'Shipping label already exists for this order',
        };
      }

      // Step 5: Generate labelNumber
      const labelNumber = await generateLabelNumber(order.storeId);

      // Step 6: Get store and pickup address
      const store = await Store.findById(order.storeId).session(session);
      if (!store) {
        return {
          success: false,
          error: 'Store not found',
        };
      }

      // Get pickup address from store tax profile or supplier tax profile
      let pickupAddress = {
        name: store.name,
        street: 'Store Address',
        city: 'Mumbai',
        state: 'Maharashtra',
        zip: '400001',
        country: 'India',
        phone: '',
      };

      // Try to get from store tax profile
      const storeTaxProfile = await TaxProfile.findOne({
        storeId: order.storeId,
        entityType: 'store',
        entityId: order.storeId.toString(),
        isActive: true,
      }).session(session);

      if (storeTaxProfile?.businessAddress) {
        const addr = storeTaxProfile.businessAddress;
        pickupAddress = {
          name: storeTaxProfile.businessName || store.name,
          street: addr.street || 'Store Address',
          city: addr.city || 'Mumbai',
          state: addr.state || 'Maharashtra',
          zip: addr.zip || '400001',
          country: addr.country || 'India',
          phone: '',
        };
      } else if (order.supplierId) {
        // Fallback to supplier tax profile
        const supplierTaxProfile = await TaxProfile.findOne({
          storeId: order.storeId,
          entityType: 'supplier',
          entityId: order.supplierId.toString(),
          isActive: true,
        }).session(session);

        if (supplierTaxProfile?.businessAddress) {
          const addr = supplierTaxProfile.businessAddress;
          const supplier = await User.findById(order.supplierId).session(session);
          pickupAddress = {
            name: supplierTaxProfile.businessName || supplier?.name || 'Supplier',
            street: addr.street || 'Supplier Address',
            city: addr.city || 'Mumbai',
            state: addr.state || 'Maharashtra',
            zip: addr.zip || '400001',
            country: addr.country || 'India',
            phone: supplier?.phone || '',
          };
        }
      }

      // Step 7: Build label data

      const deliveryAddress = {
        name: order.customerName || 'Customer',
        street: order.shippingAddress?.street || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        zip: order.shippingAddress?.zip || '',
        country: order.shippingAddress?.country || '',
        phone: '', // TODO: Get from order if available
      };

      // Calculate order weight
      const orderWeight = order.items.reduce((total, item) => {
        return total + (item.quantity * 0.5); // Default 0.5 kg per item
      }, 0);

      const packageDetails = {
        weight: orderWeight,
        dimensions: {
          length: 20, // TODO: Calculate from items
          width: 15,
          height: 10,
        },
      };

      const orderDetails = {
        orderNumber: order.orderNumber || order.orderId,
        orderId: order.orderId,
        itemCount: order.items.length,
        codAmount: order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial' ? (order.codAmount || order.grandTotal) : null,
        prepaidAmount: order.paymentMethod !== 'cod' ? order.grandTotal : null,
      };

      // Step 8: Generate PDF
      const tempDir = path.join(process.cwd(), 'temp', 'labels');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const pdfFileName = `${labelNumber}.pdf`;
      const pdfPath = path.join(tempDir, pdfFileName);

      const pdfData: ShippingLabelPdfData = {
        labelNumber,
        orderNumber: orderDetails.orderNumber,
        orderId: orderDetails.orderId,
        courierName: order.courierSnapshot.courierName,
        courierCode: order.courierSnapshot.courierCode,
        pickupAddress,
        deliveryAddress,
        packageDetails,
        orderDetails,
        awbNumber: null, // Will be set when courier API is integrated
        outputPath: pdfPath,
      };

      await generateShippingLabelPdf(pdfData);

      // Generate PDF URL (relative path for now, can be S3/CDN URL in production)
      const pdfUrl = `/api/shipping-labels/${labelNumber}/download`;

      // Step 9: Save ShippingLabel record
      const label = new ShippingLabel({
        storeId: order.storeId,
        orderId: orderObjId,
        courierId: order.courierSnapshot.courierId,
        courierName: order.courierSnapshot.courierName,
        courierCode: order.courierSnapshot.courierCode,
        labelNumber,
        awbNumber: null, // Will be set when courier API is integrated
        pickupAddress,
        deliveryAddress,
        packageDetails,
        orderDetails,
        pdfUrl,
        status: 'generated',
        generatedAt: new Date(),
        generatedBy: userObjId,
      });

      await label.save({ session });

      // Step 10: Emit LABEL_GENERATED event
      eventStreamEmitter.emit('event', {
        eventType: 'LABEL_GENERATED',
        payload: {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          labelNumber,
          courierName: order.courierSnapshot.courierName,
        },
        storeId: order.storeId.toString(),
        userId: generatedBy.toString(),
        occurredAt: new Date(),
      });

      // Audit log
      if (req) {
        await logAudit({
          req,
          action: 'SHIPPING_LABEL_GENERATED',
          entityType: 'ShippingLabel',
          entityId: label._id.toString(),
          description: `Shipping label generated: ${labelNumber} for order ${order.orderNumber}`,
          after: {
            labelNumber,
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            courierName: order.courierSnapshot.courierName,
            courierCode: order.courierSnapshot.courierCode,
          },
        });
      }

      return {
        success: true,
        label,
      };
    });
  } catch (error: any) {
    console.error('[SHIPPING LABEL GENERATION] Error:', error);
    return {
      success: false,
      error: error.message || 'Shipping label generation failed',
    };
  }
}

/**
 * Get shipping label for an order
 */
export async function getShippingLabel(
  orderId: mongoose.Types.ObjectId | string
): Promise<IShippingLabel | null> {
  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;

  const label = await ShippingLabel.findOne({
    orderId: orderObjId,
    status: 'generated',
  }).lean();

  return label;
}

