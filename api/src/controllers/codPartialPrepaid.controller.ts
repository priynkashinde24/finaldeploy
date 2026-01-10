import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { PaymentIntent } from '../models/PaymentIntent';
import { checkCODEligibility } from '../utils/codEligibility';
import { reserveInventory } from '../services/inventoryReservation.service';
import { getPaymentProvider } from '../payments/paymentProvider';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import { z } from 'zod';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';

/**
 * COD Partial Prepaid Controller
 * 
 * PURPOSE:
 * - Allow customers to pay part online, rest on delivery
 * - Create payment intent for prepaid amount
 * - Reserve inventory
 * - Track remaining COD amount
 */

const createPartialPrepaidCODSchema = z.object({
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
  prepaidAmount: z.number().min(0.01), // Amount to pay online
  onlinePaymentProvider: z.enum(['stripe', 'paypal']),
  couponCode: z.string().optional(),
});

/**
 * POST /orders/cod/partial-prepaid
 * Create order with partial prepaid + COD
 */
export const createPartialPrepaidCOD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = createPartialPrepaidCODSchema.parse(req.body);
    const {
      items,
      customerEmail,
      customerName,
      shippingAddress,
      prepaidAmount,
      onlinePaymentProvider,
      couponCode,
    } = validatedData;

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const resellerId = req.store?.store.ownerId;

    if (!resellerId) {
      sendError(res, 'Reseller ID not found', 400);
      return;
    }

    // STEP 1: Calculate order totals (simplified - should use checkout logic)
    // TODO: Integrate with existing checkout calculation logic
    let totalAmount = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const unitPrice = 100; // Placeholder
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      orderItems.push({
        productId: item.productId,
        sku: `SKU-${item.productId}`,
        name: `Product ${item.productId}`,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        supplierId: 'supplier_placeholder',
      });
    }

    const totalAmountWithTax = totalAmount; // Simplified
    const codAmount = totalAmountWithTax - prepaidAmount;

    // STEP 2: Validate amounts
    if (prepaidAmount >= totalAmountWithTax) {
      sendError(res, 'Prepaid amount must be less than total order amount', 400);
      return;
    }

    if (codAmount <= 0) {
      sendError(res, 'COD amount must be greater than 0', 400);
      return;
    }

    // STEP 3: Validate COD eligibility for remaining amount
    const eligibilityResult = await checkCODEligibility({
      storeId: storeObjId,
      userId: customerEmail,
      orderAmount: codAmount * 100, // Convert to cents
      items: items.map((item) => ({
        productId: item.productId,
        categoryId: null,
      })),
      shippingAddress,
    });

    if (!eligibilityResult.allowed) {
      sendError(res, eligibilityResult.reason || 'COD is not available for remaining amount', 400);
      return;
    }

    // STEP 4: Reserve inventory
    const variantReservationItems: Array<{
      globalVariantId: mongoose.Types.ObjectId;
      supplierId: mongoose.Types.ObjectId;
      quantity: number;
    }> = [];

    // TODO: Map items to actual variant and supplier IDs
    for (const item of items) {
      variantReservationItems.push({
        globalVariantId: new mongoose.Types.ObjectId(),
        supplierId: new mongoose.Types.ObjectId(),
        quantity: item.quantity,
      });
    }

    const reserveResult = await reserveInventory({
      storeId: storeObjId,
      orderId: new mongoose.Types.ObjectId(), // Will be set after order creation
      items: variantReservationItems,
      expiresInMinutes: 48 * 60, // 48 hours for COD
      metadata: {
        paymentMethod: 'cod_partial',
      },
    });

    if (!reserveResult.success) {
      sendError(res, reserveResult.error || 'Failed to reserve inventory', 400);
      return;
    }

    // STEP 5: Create order and payment intent (transactional)
    const result = await withTransaction(async (session) => {
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const order = new Order({
        orderId,
        storeId: storeObjId,
        resellerId,
        items: orderItems,
        totalAmount,
        totalAmountWithTax,
        status: 'pending',
        paymentMethod: 'cod_partial',
        paymentStatus: 'cod_partial_paid',
        codAmount,
        prepaidAmount,
        codEligible: true,
        codConfirmedAt: null,
        customerEmail,
        customerName,
        shippingAddress,
        couponCode: couponCode || null,
      });

      await order.save({ session });

      // Update reservation with order ID
      if (reserveResult.reservations) {
        for (const reservation of reserveResult.reservations) {
          reservation.orderId = order._id;
          await reservation.save({ session });
        }
      }

      // STEP 6: Create payment intent for prepaid amount
      const paymentProvider = getPaymentProvider(onlinePaymentProvider);
      const paymentSession = await paymentProvider.createOrderPayment({
        orderId: order.orderId,
        amount: Math.round(prepaidAmount * 100), // Convert to cents
        currency: 'USD',
        customerEmail,
        customerName,
        storeName: req.store?.store.name || 'Store',
        metadata: {
          orderId: order.orderId,
          paymentType: 'partial_prepaid',
          codAmount,
        },
      });

      // Save payment record
      if (onlinePaymentProvider === 'stripe') {
        const paymentIntent = new PaymentIntent({
          storeId: storeObjId,
          orderId: order._id,
          stripePaymentIntentId: paymentSession.providerOrderId,
          amount: Math.round(prepaidAmount * 100),
          currency: 'USD',
          paymentStatus: 'pending',
        });
        await paymentIntent.save({ session });
      } else if (onlinePaymentProvider === 'paypal') {
        const payment = new Payment({
          storeId: storeObjId,
          orderId: order._id,
          provider: 'paypal',
          providerOrderId: paymentSession.providerOrderId,
          amount: Math.round(prepaidAmount * 100),
          currency: 'USD',
          status: 'created',
          metadata: {
            paymentType: 'partial_prepaid',
            codAmount,
          },
        });
        await payment.save({ session });
      }

      // Audit log
      await logAudit({
        req,
        action: 'COD_PARTIAL_PREPAID_ORDER_PLACED',
        entityType: 'Order',
        entityId: order._id.toString(),
        description: `Partial prepaid COD order placed: ${order.orderId}`,
        after: {
          orderId: order.orderId,
          paymentMethod: 'cod_partial',
          prepaidAmount,
          codAmount,
        },
        metadata: {
          orderId: order.orderId,
          customerEmail,
          onlinePaymentProvider,
        },
      });

      return {
        order,
        paymentSession,
        onlinePaymentProvider,
      };
    });

    // Return payment session details
    if (result.onlinePaymentProvider === 'stripe') {
      sendSuccess(
        res,
        {
          orderId: result.order.orderId,
          status: result.order.status,
          paymentStatus: result.order.paymentStatus,
          prepaidAmount: result.order.prepaidAmount,
          codAmount: result.order.codAmount,
          clientSecret: result.paymentSession.clientSecret,
          paymentIntentId: result.paymentSession.providerOrderId,
          provider: 'stripe',
        },
        'Partial prepaid COD order created. Complete online payment, then pay remaining on delivery.',
        201
      );
    } else {
      sendSuccess(
        res,
        {
          orderId: result.order.orderId,
          status: result.order.status,
          paymentStatus: result.order.paymentStatus,
          prepaidAmount: result.order.prepaidAmount,
          codAmount: result.order.codAmount,
          approvalUrl: result.paymentSession.approvalUrl,
          paypalOrderId: result.paymentSession.providerOrderId,
          provider: 'paypal',
        },
        'Partial prepaid COD order created. Complete online payment, then pay remaining on delivery.',
        201
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

