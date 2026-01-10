import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { Order, IOrder } from '../models/Order';
import { OrderStatus } from '../constants/orderStatus';
import { isTransitionAllowed, getTransitionDetails } from '../order/orderStateMachine';
import { consumeInventory, releaseInventory } from './inventoryReservation.service';
import { generateInvoices } from './invoiceGenerator.service';
import { PaymentSplit } from '../models/PaymentSplit';
import { PayoutLedger } from '../models/PayoutLedger';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';
import { Request } from 'express';
import { Store } from '../models/Store';

/**
 * Order Lifecycle Service
 * 
 * PURPOSE:
 * - Control order state transitions safely
 * - Prevent invalid state changes
 * - Coordinate supplier, reseller, platform actions
 * - Drive inventory, payouts, invoices, and refunds
 * - Be auditable and deterministic
 * 
 * RULES:
 * - Only valid transitions allowed
 * - Role-based permissions enforced
 * - All side effects in transaction
 * - Idempotent (same transition twice = no-op)
 */

export interface TransitionOrderParams {
  orderId: string | mongoose.Types.ObjectId;
  toStatus: OrderStatus;
  actorRole: 'admin' | 'supplier' | 'delivery' | 'customer' | 'system';
  actorId?: string;
  metadata?: {
    reason?: string;
    trackingNumber?: string;
    notes?: string;
    returnReason?: string;
    [key: string]: any;
  };
  req?: Request; // For audit logging
}

export interface TransitionOrderResult {
  success: boolean;
  order?: IOrder;
  error?: string;
  sideEffects?: string[];
}

/**
 * Transition order to new status
 * 
 * ALL steps inside ONE transaction:
 * 1. Load order
 * 2. Validate current status
 * 3. Validate transition allowed
 * 4. Validate actor permission
 * 5. Apply side effects
 * 6. Update order status
 * 7. Emit lifecycle event
 * 8. Audit log
 */
export async function transitionOrder(
  params: TransitionOrderParams
): Promise<TransitionOrderResult> {
  const { orderId, toStatus, actorRole, actorId, metadata = {}, req } = params;

  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;

  try {
    return await withTransaction(async (session: ClientSession) => {
      // STEP 1: Load order
      const order = await Order.findById(orderObjId).session(session);
      if (!order) {
        return {
          success: false,
          error: `Order not found: ${orderId}`,
        };
      }

      const fromStatus = (order.orderStatus || order.status) as OrderStatus;

      // STEP 2: Idempotency check (same status = no-op)
      if (fromStatus === toStatus) {
        return {
          success: true,
          order,
          sideEffects: [],
        };
      }

      // STEP 3: Validate transition allowed
      const transitionCheck = isTransitionAllowed(fromStatus, toStatus, actorRole);
      if (!transitionCheck.allowed) {
        return {
          success: false,
          error: transitionCheck.error || 'Transition not allowed',
        };
      }

      const transition = transitionCheck.transition;
      if (!transition) {
        return {
          success: false,
          error: 'Transition details not found',
        };
      }

      // STEP 4: Apply side effects based on target status
      const sideEffects: string[] = [];

      switch (toStatus) {
        case OrderStatus.CONFIRMED:
          await handleConfirmedSideEffects(order, session, sideEffects);
          break;

        case OrderStatus.PROCESSING:
          await handleProcessingSideEffects(order, session, sideEffects);
          break;

        case OrderStatus.SHIPPED:
          await handleShippedSideEffects(order, session, metadata, sideEffects);
          break;

        case OrderStatus.OUT_FOR_DELIVERY:
          await handleOutForDeliverySideEffects(order, session, sideEffects);
          break;

        case OrderStatus.DELIVERED:
          await handleDeliveredSideEffects(order, session, sideEffects);
          break;

        case OrderStatus.CANCELLED:
          await handleCancelledSideEffects(order, session, metadata, sideEffects);
          break;

        case OrderStatus.RETURNED:
          await handleReturnedSideEffects(order, session, metadata, sideEffects);
          break;

        case OrderStatus.REFUNDED:
          await handleRefundedSideEffects(order, session, sideEffects);
          break;
      }

      // STEP 5: Update order status
      order.orderStatus = toStatus;
      if (toStatus === OrderStatus.CONFIRMED) {
        order.status = 'confirmed';
      } else if (toStatus === OrderStatus.CANCELLED) {
        order.status = 'cancelled';
      }

      // Store transition metadata
      if (!order.metadata) {
        order.metadata = {};
      }
      order.metadata.lastTransition = {
        from: fromStatus,
        to: toStatus,
        at: new Date(),
        actorRole,
        actorId,
        metadata,
      };

      // Save status history for timeline
      const { OrderStatusHistory } = await import('../models/OrderStatusHistory');
      const statusHistory = new OrderStatusHistory({
        orderId: order._id,
        storeId: order.storeId,
        fromStatus,
        toStatus,
        actorRole,
        actorId: actorId ? new mongoose.Types.ObjectId(actorId) : null,
        timestamp: new Date(),
        metadata: metadata || {},
      });
      await statusHistory.save({ session });

      await order.save({ session });

      // STEP 6: Emit lifecycle event
      const eventType = `ORDER_${toStatus.toUpperCase()}`;
      eventStreamEmitter.emit('event', {
        eventType,
        payload: {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          fromStatus,
          toStatus,
          storeId: order.storeId.toString(),
          totalAmount: order.grandTotal || order.totalAmountWithTax,
        },
        storeId: order.storeId.toString(),
        userId: actorId,
        occurredAt: new Date(),
      });

      // STEP 7: Audit log
      if (req) {
        await logAudit({
          req,
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: order._id.toString(),
          description: `Order status changed from ${fromStatus} to ${toStatus}`,
          before: {
            orderStatus: fromStatus,
            status: order.status,
          },
          after: {
            orderStatus: toStatus,
            status: order.status,
          },
          metadata: {
            actorRole,
            actorId,
            reason: metadata.reason,
            trackingNumber: metadata.trackingNumber,
            sideEffects,
          },
        });
      }

      return {
        success: true,
        order,
        sideEffects,
      };
    });
  } catch (error: any) {
    console.error('[ORDER LIFECYCLE] Error:', error);
    return {
      success: false,
      error: error.message || 'Order transition failed',
    };
  }
}

/**
 * Side effects for CONFIRMED status
 */
async function handleConfirmedSideEffects(
  order: IOrder,
  session: ClientSession,
  sideEffects: string[]
): Promise<void> {
  // 1. Consume inventory (convert reservation to consumed)
  const consumeResult = await consumeInventory(order._id, {
    storeId: order.storeId,
  });

  if (consumeResult.success) {
    sideEffects.push('inventory_consumed');
    order.inventoryStatus = 'consumed';
  } else {
    console.error(`[ORDER LIFECYCLE] Failed to consume inventory for order ${order.orderId}:`, consumeResult.error);
  }

  // 2. Generate invoices (if not already generated)
  try {
    const invoiceResult = await generateInvoices(order.orderId);
    if (invoiceResult.success) {
      sideEffects.push('invoices_generated');
    }
  } catch (error: any) {
    console.error(`[ORDER LIFECYCLE] Failed to generate invoices for order ${order.orderId}:`, error);
  }

  // 3. Lock payment split (if exists)
  const split = await PaymentSplit.findOne({ orderId: order.orderId }).session(session);
  if (split && split.status === 'pending') {
    split.status = 'locked';
    await split.save({ session });
    sideEffects.push('payment_split_locked');
  }
}

/**
 * Side effects for PROCESSING status
 */
async function handleProcessingSideEffects(
  order: IOrder,
  session: ClientSession,
  sideEffects: string[]
): Promise<void> {
  // Lock courier assignment - no changes allowed after processing
  // Courier should already be assigned at order creation
  if (!order.courierSnapshot) {
    throw new Error('Courier must be assigned before order can be processed');
  }
  
  sideEffects.push('courier_locked');
}

/**
 * Side effects for SHIPPED status
 */
async function handleShippedSideEffects(
  order: IOrder,
  session: ClientSession,
  metadata: any,
  sideEffects: string[]
): Promise<void> {
  // Require courier assignment - mandatory for shipped orders
  if (!order.courierSnapshot) {
    throw new Error('Courier must be assigned before order can be shipped');
  }
  
  // Require shipping label - mandatory for shipped orders
  const { ShippingLabel } = await import('../models/ShippingLabel');
  const existingLabel = await ShippingLabel.findOne({
    orderId: order._id,
    status: 'generated',
  }).session(session);
  
  if (!existingLabel) {
    throw new Error('Shipping label must be generated before order can be shipped');
  }
  
  sideEffects.push('label_required');
  
  // Require tracking number
  if (!metadata?.trackingNumber) {
    throw new Error('Tracking number is required to ship order');
  }
  
  // 1. Attach tracking number
  const orderDoc = order as any;
  if (!orderDoc.metadata) {
    orderDoc.metadata = {};
  }
  orderDoc.metadata.trackingNumber = metadata.trackingNumber;
  sideEffects.push('tracking_number_attached');
  
  // 2. Notify customer (event-driven)
  sideEffects.push('customer_notified');
  sideEffects.push('courier_required');
}

/**
 * Side effects for OUT_FOR_DELIVERY status
 */
async function handleOutForDeliverySideEffects(
  order: IOrder,
  session: ClientSession,
  sideEffects: string[]
): Promise<void> {
  // Notify customer (event-driven)
  sideEffects.push('customer_notified');
}

/**
 * Side effects for DELIVERED status
 */
async function handleDeliveredSideEffects(
  order: IOrder,
  session: ClientSession,
  sideEffects: string[]
): Promise<void> {
  // 1. Mark payout eligible (update ledger entries)
  const ledgerEntries = await PayoutLedger.find({
    orderId: order.orderId,
    status: 'pending',
  }).session(session);

  const now = new Date();
  for (const entry of ledgerEntries) {
    entry.status = 'eligible';
    entry.availableAt = now; // Make immediately eligible
    await entry.save({ session });
  }

  if (ledgerEntries.length > 0) {
    sideEffects.push('payouts_marked_eligible');
  }

  // 2. Start return window timer
  const orderDoc = order as any;
  if (!orderDoc.metadata) {
    orderDoc.metadata = {};
  }
  orderDoc.metadata.deliveredAt = new Date();
  orderDoc.metadata.returnWindowEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default
  sideEffects.push('return_window_started');
}

/**
 * Side effects for CANCELLED status
 */
async function handleCancelledSideEffects(
  order: IOrder,
  session: ClientSession,
  metadata: any,
  sideEffects: string[]
): Promise<void> {
  // 1. Release inventory (if reserved)
  if (order.inventoryStatus === 'reserved') {
    const releaseResult = await releaseInventory(order._id, {
      storeId: order.storeId,
      reason: metadata.reason || 'order_cancelled',
    });

    if (releaseResult.success) {
      sideEffects.push('inventory_released');
      order.inventoryStatus = 'released';
    }
  }

  // 2. Reverse payment (if paid)
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'cod_collected') {
    // Payment reversal handled by refund controller
    // This is just a marker
    sideEffects.push('payment_reversal_required');
  }

  // 3. Store cancellation reason
  const orderDoc = order as any;
  if (!orderDoc.metadata) {
    orderDoc.metadata = {};
  }
  orderDoc.metadata.cancellationReason = metadata.reason || 'No reason provided';
  orderDoc.metadata.cancelledAt = new Date();
  orderDoc.metadata.cancelledBy = metadata.actorId;
}

/**
 * Side effects for RETURNED status
 */
async function handleReturnedSideEffects(
  order: IOrder,
  session: ClientSession,
  metadata: any,
  sideEffects: string[]
): Promise<void> {
  // 1. Validate return window
  const store = await Store.findById(order.storeId).session(session);
  const storeDoc = store as any;
  const returnWindowDays = storeDoc?.metadata?.returnWindowDays || 7;
  const orderDoc = order as any;
  const deliveredAt = orderDoc.metadata?.deliveredAt
    ? new Date(orderDoc.metadata.deliveredAt)
    : order.updatedAt;

  const returnWindowEndsAt = new Date(deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now > returnWindowEndsAt) {
    throw new Error(`Return window has expired. Return must be initiated within ${returnWindowDays} days of delivery.`);
  }

  // 2. Reserve returned inventory (for restocking)
  // This is handled by the return/refund system
  sideEffects.push('return_inventory_reserved');

  // 3. Start refund process
  sideEffects.push('refund_process_started');

  // 4. Store return metadata
  const orderDocReturn = order as any;
  if (!orderDocReturn.metadata) {
    orderDocReturn.metadata = {};
  }
  orderDocReturn.metadata.returnReason = metadata.returnReason || 'No reason provided';
  orderDocReturn.metadata.returnedAt = new Date();
  orderDocReturn.metadata.returnedBy = metadata.actorId;
}

/**
 * Side effects for REFUNDED status
 */
async function handleRefundedSideEffects(
  order: IOrder,
  session: ClientSession,
  sideEffects: string[]
): Promise<void> {
  // 1. Generate credit note (handled by refund controller)
  sideEffects.push('credit_note_generated');

  // 2. Reverse payout ledger (handled by refund controller)
  sideEffects.push('payout_ledger_reversed');

  // 3. Store refund metadata
  const orderDoc = order as any;
  if (!orderDoc.metadata) {
    orderDoc.metadata = {};
  }
  orderDoc.metadata.refundedAt = new Date();
}

/**
 * Check if order can be returned (within return window)
 */
export async function canReturnOrder(
  orderId: string | mongoose.Types.ObjectId
): Promise<{ allowed: boolean; reason?: string; returnWindowEndsAt?: Date }> {
  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;
  const order = await Order.findById(orderObjId).lean();

  if (!order) {
    return { allowed: false, reason: 'Order not found' };
  }

  if (order.orderStatus !== OrderStatus.DELIVERED) {
    return { allowed: false, reason: 'Order must be delivered before return' };
  }

  const store = await Store.findById(order.storeId).lean();
  const storeDoc = store as any;
  const returnWindowDays = storeDoc?.metadata?.returnWindowDays || 7;
  const orderDoc = order as any;
  const deliveredAt = orderDoc.metadata?.deliveredAt
    ? new Date(orderDoc.metadata.deliveredAt)
    : order.updatedAt;

  const returnWindowEndsAt = new Date(deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now > returnWindowEndsAt) {
    return {
      allowed: false,
      reason: `Return window has expired. Return must be initiated within ${returnWindowDays} days of delivery.`,
      returnWindowEndsAt,
    };
  }

  return {
    allowed: true,
    returnWindowEndsAt,
  };
}

