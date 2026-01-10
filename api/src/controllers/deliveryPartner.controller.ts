import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Order } from '../models/Order';
import { DeliveryStatus } from '../models/DeliveryStatus';
import { DeliveryPartner } from '../models/DeliveryPartner';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import { z } from 'zod';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';

/**
 * Delivery Partner Controller
 * 
 * PURPOSE:
 * - Handle delivery status updates from partners
 * - Update order delivery status
 * - Trigger COD collection on delivery
 */

const updateDeliveryStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned']),
  trackingNumber: z.string().optional(),
  currentLocation: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
  deliveryNotes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * POST /delivery/status/update
 * Update delivery status (called by delivery partner webhook)
 */
export const updateDeliveryStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify webhook signature (if API key provided)
    const apiKey = req.headers['x-api-key'] as string;
    const partnerCode = req.headers['x-partner-code'] as string;

    if (partnerCode) {
      const partner = await DeliveryPartner.findOne({ code: partnerCode, isActive: true });
      if (!partner) {
        sendError(res, 'Invalid delivery partner', 403);
        return;
      }

      if (partner.apiKey && partner.apiKey !== apiKey) {
        sendError(res, 'Invalid API key', 403);
        return;
      }
    }

    const validatedData = updateDeliveryStatusSchema.parse(req.body);
    const {
      orderId,
      status,
      trackingNumber,
      currentLocation,
      estimatedDeliveryDate,
      deliveryNotes,
      metadata,
    } = validatedData;

    await withTransaction(async (session) => {
      // Get order
      const order = await Order.findOne({ orderId }).session(session);
      if (!order) {
        sendError(res, 'Order not found', 404);
        return;
      }

      // Get or create delivery status
      let deliveryStatus = await DeliveryStatus.findOne({
        orderId: order._id,
        storeId: order.storeId,
      }).session(session);

      if (!deliveryStatus) {
        deliveryStatus = new DeliveryStatus({
          orderId: order._id,
          storeId: order.storeId,
          status: 'pending',
        });
      }

      // Update delivery status
      deliveryStatus.status = status;
      if (trackingNumber) deliveryStatus.trackingNumber = trackingNumber;
      if (currentLocation) deliveryStatus.currentLocation = currentLocation;
      if (estimatedDeliveryDate) deliveryStatus.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
      if (deliveryNotes) deliveryStatus.deliveryNotes = deliveryNotes;
      if (metadata) deliveryStatus.metadata = { ...deliveryStatus.metadata, ...metadata };

      if (status === 'delivered') {
        deliveryStatus.deliveredAt = new Date();

        // If COD order, trigger collection reminder
        if (order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') {
          if (order.paymentStatus === 'cod_pending' || order.paymentStatus === 'cod_partial_paid') {
            // Emit event for COD collection
            eventStreamEmitter.emit('event', {
              eventType: 'order.delivered.cod_pending',
              payload: {
                orderId: order.orderId,
                storeId: order.storeId.toString(),
                codAmount: order.codAmount || order.totalAmountWithTax || order.totalAmount,
              },
              storeId: order.storeId.toString(),
              userId: order.customerEmail || undefined,
              occurredAt: new Date(),
            });
          }
        }
      }

      await deliveryStatus.save({ session });

      // Emit delivery status update event
      eventStreamEmitter.emit('event', {
        eventType: 'order.delivery.updated',
        payload: {
          orderId: order.orderId,
          storeId: order.storeId.toString(),
          deliveryStatus: status,
          trackingNumber,
        },
        storeId: order.storeId.toString(),
        userId: order.customerEmail || undefined,
        occurredAt: new Date(),
      });

      // Audit log
      await logAudit({
        storeId: order.storeId.toString(),
        actorRole: 'system',
        action: 'DELIVERY_STATUS_UPDATED',
        entityType: 'DeliveryStatus',
        entityId: deliveryStatus._id.toString(),
        description: `Delivery status updated to ${status} for order ${order.orderId}`,
        after: {
          status,
          trackingNumber,
          currentLocation,
        },
        metadata: {
          orderId: order.orderId,
          partnerCode,
        },
      });
    });

    sendSuccess(res, { message: 'Delivery status updated successfully' }, 'Delivery status updated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /delivery/status/:orderId
 * Get delivery status for an order
 */
export const getDeliveryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { orderId } = req.params;

    if (!storeId) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const order = await Order.findOne({
      orderId,
      storeId: new mongoose.Types.ObjectId(storeId),
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    const deliveryStatus = await DeliveryStatus.findOne({
      orderId: order._id,
      storeId: order.storeId,
    });

    sendSuccess(res, { deliveryStatus }, 'Delivery status retrieved successfully');
  } catch (error) {
    next(error);
  }
};

