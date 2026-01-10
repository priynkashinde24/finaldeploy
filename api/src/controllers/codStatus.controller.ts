import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Order } from '../models/Order';
import { consumeInventory, releaseInventory } from '../services/inventoryReservation.service';
import { recordCODFailure, updateCODCancellationRate } from '../utils/codEligibility';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import { z } from 'zod';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';

/**
 * COD Status Controller
 * 
 * PURPOSE:
 * - Mark COD as collected
 * - Mark COD as failed
 * - Update inventory accordingly
 * - Track abuse
 */

const collectCODSchema = z.object({
  orderId: z.string().min(1),
  collectedAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const failCODSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().optional(),
});

/**
 * PATCH /orders/:id/cod/collect
 * Mark COD as collected
 */
export const collectCOD = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const { id: orderId } = req.params;
    const validatedData = collectCODSchema.parse(req.body);
    const { collectedAmount, notes } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    await withTransaction(async (session) => {
      // Get order
      const order = await Order.findOne({
        orderId,
        storeId: storeObjId,
        paymentMethod: 'cod',
      }).session(session);

      if (!order) {
        sendError(res, 'COD order not found', 404);
        return;
      }

      if (order.paymentStatus !== 'cod_pending') {
        sendError(res, `Order status is ${order.paymentStatus}, cannot collect COD`, 400);
        return;
      }

      // Validate collected amount
      // For partial prepaid orders, COD amount is the remaining amount
      const expectedAmount = order.codAmount || (order.totalAmountWithTax || order.totalAmount) - (order.prepaidAmount || 0);
      if (collectedAmount && Math.abs(collectedAmount - expectedAmount) > 0.01) {
        sendError(res, `Collected amount (${collectedAmount}) does not match expected amount (${expectedAmount})`, 400);
        return;
      }

      // Update order
      order.paymentStatus = 'cod_collected';
      order.status = 'paid';
      order.codConfirmedAt = new Date();
      await order.save({ session });

      // Consume inventory reservation
      const consumeResult = await consumeInventory(order._id, { storeId: storeId });
      if (!consumeResult.success) {
        console.error(`[COD COLLECT] Failed to consume inventory for order ${order.orderId}:`, consumeResult.error);
        // Don't fail the transaction, but log the error
      }

      // Create payment split (ledger-based)
      const { createPaymentSplit } = await import('../services/splitPayment.service');
      const splitResult = await createPaymentSplit({
        order,
        paymentMethod: 'cod',
        actorId: currentUser.id,
        actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      });

      if (!splitResult.success) {
        console.error(
          `[COD COLLECT] Failed to create payment split for order ${order.orderId}:`,
          splitResult.error
        );
        // Don't fail the transaction, but log the error
      }

      // Generate invoices (async, non-blocking)
      const { generateInvoices } = await import('../services/invoiceGenerator.service');
      generateInvoices(order.orderId).catch((error: any) => {
        console.error(`[COD COLLECT] Failed to generate invoices for order ${order.orderId}:`, error);
      });

      // Emit PAYMENT_SUCCESS event
      eventStreamEmitter.emit('event', {
        eventType: 'order.paid',
        payload: {
          orderId: order.orderId,
          storeId: storeId,
          paymentMethod: 'cod',
          amount: expectedAmount,
        },
        storeId: storeId,
        userId: order.customerEmail || undefined,
        occurredAt: new Date(),
      });

      // Audit log
      await logAudit({
        req,
        action: 'COD_COLLECTED',
        entityType: 'Order',
        entityId: order._id.toString(),
        description: `COD collected for order ${order.orderId}`,
        after: {
          paymentStatus: 'cod_collected',
          codConfirmedAt: order.codConfirmedAt,
        },
        metadata: {
          orderId: order.orderId,
          collectedAmount: collectedAmount || expectedAmount,
          notes,
        },
      });
    });

    sendSuccess(res, { message: 'COD collected successfully' }, 'COD collected successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /orders/:id/cod/fail
 * Mark COD as failed
 */
export const failCOD = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const { id: orderId } = req.params;
    const validatedData = failCODSchema.parse(req.body);
    const { reason } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    await withTransaction(async (session) => {
      // Get order
      const order = await Order.findOne({
        orderId,
        storeId: storeObjId,
        paymentMethod: 'cod',
      }).session(session);

      if (!order) {
        sendError(res, 'COD order not found', 404);
        return;
      }

      if (order.paymentStatus === 'cod_collected') {
        sendError(res, 'COD already collected, cannot mark as failed', 400);
        return;
      }

      // Update order
      order.paymentStatus = 'cod_failed';
      order.status = 'cancelled';
      await order.save({ session });

      // Release inventory reservation
      const releaseResult = await releaseInventory(order._id, { storeId: storeId });
      if (!releaseResult.success) {
        console.error(`[COD FAIL] Failed to release inventory for order ${order.orderId}:`, releaseResult.error);
        // Don't fail the transaction, but log the error
      }

      // Record COD failure for abuse tracking
      if (order.customerEmail) {
        await recordCODFailure(order.customerEmail, storeObjId);
        await updateCODCancellationRate(order.customerEmail, storeObjId);
      }

      // Emit PAYMENT_FAILED event
      eventStreamEmitter.emit('event', {
        eventType: 'order.payment.failed',
        payload: {
          orderId: order.orderId,
          storeId: storeId,
          paymentMethod: 'cod',
          reason: reason || 'COD payment failed',
        },
        storeId: storeId,
        userId: order.customerEmail || undefined,
        occurredAt: new Date(),
      });

      // Audit log
      await logAudit({
        req,
        action: 'COD_FAILED',
        entityType: 'Order',
        entityId: order._id.toString(),
        description: `COD failed for order ${order.orderId}`,
        after: {
          paymentStatus: 'cod_failed',
          status: 'cancelled',
        },
        metadata: {
          orderId: order.orderId,
          reason: reason || 'COD payment failed',
          customerEmail: order.customerEmail,
        },
      });
    });

    sendSuccess(res, { message: 'COD marked as failed' }, 'COD marked as failed');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

