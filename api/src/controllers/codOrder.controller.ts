import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Order } from '../models/Order';
import { checkCODEligibility } from '../utils/codEligibility';
import { reserveInventory } from '../services/inventoryReservation.service';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import { z } from 'zod';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';

/**
 * COD Order Controller
 * 
 * PURPOSE:
 * - Place COD orders
 * - Validate COD eligibility
 * - Reserve inventory
 * - Never mark payment as collected
 */

const placeCODOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().optional(),
      quantity: z.number().min(1),
    })
  ).min(1),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
  }),
  couponCode: z.string().optional(),
});

/**
 * POST /orders/cod/place
 * Place a COD order
 */
export const placeCODOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = placeCODOrderSchema.parse(req.body);
    const { items, customerEmail, customerName, shippingAddress, couponCode } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const resellerId = req.store?.store.ownerId;

    if (!resellerId) {
      sendError(res, 'Reseller ID not found', 400);
      return;
    }

    // STEP 1: Process items and calculate totals (similar to checkoutController)
    // This is simplified - in production, you'd reuse the checkout calculation logic
    const orderItems: any[] = [];
    let totalAmount = 0;

    // TODO: Integrate with existing checkout calculation logic
    // For now, simplified version
    for (const item of items) {
      // Fetch product details and calculate price
      // This should use the same logic as checkoutController
      // For brevity, assuming basic calculation
      const unitPrice = 100; // Placeholder - should fetch from ResellerProduct
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      orderItems.push({
        productId: item.productId,
        sku: `SKU-${item.productId}`,
        name: `Product ${item.productId}`,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        supplierId: 'supplier_placeholder', // Should fetch from product
      });
    }

    const totalAmountWithTax = totalAmount; // Simplified - should calculate tax

    // STEP 2: Validate COD eligibility
    const eligibilityResult = await checkCODEligibility({
      storeId: storeObjId,
      userId: customerEmail,
      orderAmount: totalAmountWithTax * 100, // Convert to cents/paise
      items: items.map((item) => ({
        productId: item.productId,
        categoryId: null, // Should fetch from product
      })),
      shippingAddress,
    });

    if (!eligibilityResult.allowed) {
      sendError(res, eligibilityResult.reason || 'COD is not available for this order', 400);
      return;
    }

    // STEP 3: Reserve inventory (transactional)
    // Collect variant reservation items
    const variantReservationItems: Array<{
      globalVariantId: mongoose.Types.ObjectId;
      supplierId: mongoose.Types.ObjectId;
      quantity: number;
    }> = [];

    // TODO: Map items to globalVariantId and supplierId
    // For now, simplified - should fetch from ResellerProduct
    for (const item of items) {
      // This should fetch actual variant and supplier IDs
      variantReservationItems.push({
        globalVariantId: new mongoose.Types.ObjectId(), // Placeholder
        supplierId: new mongoose.Types.ObjectId(), // Placeholder
        quantity: item.quantity,
      });
    }

    // Reserve inventory with longer expiry for COD (e.g., 48 hours)
    const reserveResult = await reserveInventory({
      storeId: storeObjId,
      orderId: new mongoose.Types.ObjectId(), // Will be set after order creation
      items: variantReservationItems,
      expiresInMinutes: 48 * 60, // 48 hours for COD
      metadata: {
        paymentMethod: 'cod',
      },
    });

    if (!reserveResult.success) {
      sendError(
        res,
        reserveResult.error || 'Failed to reserve inventory',
        400
      );
      return;
    }

    // STEP 4: Create order (transactional)
    const order = await withTransaction(async (session) => {
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const order = new Order({
        orderId,
        storeId: storeObjId,
        resellerId,
        items: orderItems,
        totalAmount,
        totalAmountWithTax,
        status: 'pending',
        paymentMethod: 'cod',
        paymentStatus: 'cod_pending',
        codAmount: totalAmountWithTax,
        codEligible: true,
        codConfirmedAt: null,
        customerEmail,
        customerName,
        shippingAddress,
        couponCode: couponCode || null,
      });

      await order.save({ session });

      // Update reservation with actual order ID
      if (reserveResult.reservations) {
        for (const reservation of reserveResult.reservations) {
          reservation.orderId = order._id;
          await reservation.save({ session });
        }
      }

      // STEP 5: Emit ORDER_PLACED event
      eventStreamEmitter.emit('event', {
        eventType: 'order.placed',
        payload: {
          orderId: order.orderId,
          storeId: storeId,
          paymentMethod: 'cod',
          amount: totalAmountWithTax,
        },
        storeId: storeId,
        userId: customerEmail,
        occurredAt: new Date(),
      });

      // STEP 6: Audit log
      await logAudit({
        req,
        action: 'COD_ORDER_PLACED',
        entityType: 'Order',
        entityId: order._id.toString(),
        description: `COD order placed: ${order.orderId}`,
        after: {
          orderId: order.orderId,
          paymentMethod: 'cod',
          paymentStatus: 'cod_pending',
          amount: totalAmountWithTax,
        },
        metadata: {
          orderId: order.orderId,
          customerEmail,
          codAmount: totalAmountWithTax,
        },
      });

      return order;
    });

    sendSuccess(
      res,
      {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        codAmount: order.codAmount,
        message: 'Order placed successfully. Payment will be collected on delivery.',
      },
      'COD order placed successfully',
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

