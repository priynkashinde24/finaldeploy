import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { stripe } from '../lib/stripe';
import { Refund } from '../models/Refund';
import { PaymentIntent } from '../models/PaymentIntent';
import { Order } from '../models/Order';
import { SupplierVariantInventory } from '../models/SupplierVariantInventory';
import { InventoryReservation } from '../models/InventoryReservation';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';

/**
 * Stripe Refund Controller
 * 
 * PURPOSE:
 * - Process full and partial refunds
 * - Restore inventory on refund
 * - Track refund status
 */

const createRefundSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  refundType: z.enum(['full', 'partial']),
  amount: z.number().optional(), // Required for partial refunds
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().min(1),
      })
    )
    .optional(), // Required for partial refunds
});

/**
 * POST /payments/stripe/refunds/create
 * Create refund for an order
 */
export const createRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = createRefundSchema.parse(req.body);
    const { orderId, refundType, amount, reason, items } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Get order
    const order = await Order.findOne({
      orderId,
      storeId: storeObjId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    if (order.status !== 'paid') {
      sendError(res, 'Only paid orders can be refunded', 400);
      return;
    }

    // Get payment intent
    const paymentIntent = await PaymentIntent.findOne({
      storeId: storeObjId,
      orderId: order._id,
      paymentStatus: 'paid',
    });

    if (!paymentIntent) {
      sendError(res, 'Payment intent not found', 404);
      return;
    }

    // Calculate refund amount
    let refundAmount: number;
    let itemsRefunded: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      amount: number;
    }> = [];

    if (refundType === 'full') {
      refundAmount = paymentIntent.amount;
      // All items are refunded
      itemsRefunded = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        amount: item.totalPrice * 100, // Convert to cents
      }));
    } else {
      // Partial refund
      if (!amount || !items || items.length === 0) {
        sendError(res, 'Amount and items are required for partial refunds', 400);
        return;
      }

      refundAmount = Math.round(amount * 100); // Convert to cents

      // Validate refund amount doesn't exceed order amount
      if (refundAmount > paymentIntent.amount) {
        sendError(res, 'Refund amount cannot exceed order amount', 400);
        return;
      }

      // Calculate item refunds
      for (const refundItem of items) {
        const orderItem = order.items.find((item) => item.productId === refundItem.productId);
        if (!orderItem) {
          sendError(res, `Item ${refundItem.productId} not found in order`, 400);
          return;
        }

        if (refundItem.quantity > orderItem.quantity) {
          sendError(res, `Refund quantity cannot exceed order quantity for item ${refundItem.productId}`, 400);
          return;
        }

        const itemRefundAmount = (orderItem.unitPrice * refundItem.quantity * 100); // Convert to cents
        itemsRefunded.push({
          productId: refundItem.productId,
          variantId: refundItem.variantId,
          quantity: refundItem.quantity,
          amount: itemRefundAmount,
        });
      }
    }

    // Create refund in Stripe
    const stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntent.stripePaymentIntentId,
      amount: refundAmount,
      reason: reason ? (reason as 'duplicate' | 'fraudulent' | 'requested_by_customer') : undefined,
      metadata: {
        orderId: order.orderId,
        storeId: storeId,
        refundType: refundType,
      },
    });

    // Create refund record
    const refund = new Refund({
      storeId: storeObjId,
      orderId: order.orderId,
      paymentIntentId: paymentIntent.stripePaymentIntentId,
      stripeRefundId: stripeRefund.id,
      refundType: refundType,
      amount: refundAmount,
      currency: paymentIntent.currency,
      reason: reason || null,
      status: stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending',
      itemsRefunded: itemsRefunded,
      inventoryRestored: false,
    });

    await refund.save();

    // Restore inventory if refund succeeded
    if (stripeRefund.status === 'succeeded') {
      await restoreInventoryForRefund(refund, order, storeObjId);

      // Reverse payment split (create negative ledger entries)
      const { reversePaymentSplit } = await import('../services/splitPayment.service');
      const reverseResult = await reversePaymentSplit(
        order.orderId,
        `Refund: ${reason || 'No reason provided'}`,
        currentUser.id,
        currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system'
      );

      if (!reverseResult.success) {
        console.error(
          `[STRIPE REFUND] Failed to reverse payment split for order ${order.orderId}:`,
          reverseResult.error
        );
        // Don't fail the transaction, but log the error
      }
    }

    // Audit log
    await logAudit({
      req,
      action: 'REFUND_CREATED',
      entityType: 'Refund',
      entityId: refund._id.toString(),
      description: `${refundType} refund created for order ${order.orderId}`,
      after: {
        refundType: refundType,
        amount: refundAmount,
        status: refund.status,
        itemsRefunded: itemsRefunded.length,
      },
      metadata: {
        orderId: order.orderId,
        stripeRefundId: stripeRefund.id,
      },
    });

    sendSuccess(
      res,
      {
        refundId: refund._id.toString(),
        stripeRefundId: stripeRefund.id,
        amount: refundAmount / 100, // Convert back to dollars
        status: refund.status,
        inventoryRestored: refund.inventoryRestored,
      },
      'Refund created successfully',
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * Restore inventory for refunded items
 */
async function restoreInventoryForRefund(
  refund: any,
  order: any,
  storeId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    await withTransaction(async (session) => {
      for (const refundItem of refund.itemsRefunded) {
        // Find inventory reservation for this item
        const reservation = await InventoryReservation.findOne({
          storeId: storeId,
          orderId: order._id,
          status: 'consumed',
        })
          .populate('globalVariantId')
          .session(session);

        if (reservation && reservation.globalVariantId) {
          // Find supplier inventory
          const supplierInventory = await SupplierVariantInventory.findOne({
            storeId: storeId,
            supplierId: reservation.supplierId,
            globalVariantId: reservation.globalVariantId,
          }).session(session);

          if (supplierInventory) {
            // Restore inventory
            supplierInventory.availableStock += refundItem.quantity;
            supplierInventory.totalStock += refundItem.quantity;
            supplierInventory.lastUpdatedAt = new Date();
            await supplierInventory.save({ session });
          }
        }
      }

      // Mark refund as inventory restored
      refund.inventoryRestored = true;
      await refund.save({ session });
    });
  } catch (error: any) {
    console.error('[REFUND] Error restoring inventory:', error);
    // Don't fail refund if inventory restoration fails
  }
}

/**
 * GET /payments/stripe/refunds/:orderId
 * Get refunds for an order
 */
export const getOrderRefunds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { orderId } = req.params;

    if (!storeId) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const refunds = await Refund.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      orderId: orderId,
    }).sort({ createdAt: -1 });

    sendSuccess(res, { refunds }, 'Refunds fetched successfully');
  } catch (error) {
    next(error);
  }
};

