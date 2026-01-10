import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { RMA, IRMA, IRMAItem } from '../models/RMA';
import { Order, IOrder } from '../models/Order';
import { OriginVariantInventory } from '../models/OriginVariantInventory';
import { InventoryReservation } from '../models/InventoryReservation';
import { PaymentSplit } from '../models/PaymentSplit';
import { PayoutLedger } from '../models/PayoutLedger';
import { CreditNote } from '../models/CreditNote';
import { generateRMANumber } from '../utils/rmaNumber';
import { validateReturn, ReturnItemRequest } from '../utils/returnPolicy';
import { generateCreditNoteNumber } from '../utils/invoiceNumber';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';
import { Request } from 'express';
import { resolveReturnShippingRule, getFallbackGlobalRule } from '../utils/returnShippingRuleEngine';
import { calculateReturnShipping } from '../utils/returnShippingCalculator';
import { ProductVariant } from '../models/ProductVariant';

/**
 * RMA Service
 *
 * PURPOSE:
 * - Handle RMA request creation
 * - Approve/reject RMAs
 * - Process item receipt and inventory reversal
 * - Calculate and execute refunds
 * - Generate credit notes
 * - Adjust payouts
 *
 * RULES:
 * - No return before delivery
 * - No refund without RMA
 * - Inventory reversal only after receipt
 * - Refund ≤ paid amount
 * - Immutable snapshots
 */

export interface CreateRMAParams {
  orderId: string;
  items: ReturnItemRequest[];
  refundMethod: 'original' | 'wallet' | 'cod_adjustment';
  storeId: mongoose.Types.ObjectId | string;
  customerId?: mongoose.Types.ObjectId | string;
  req?: Request;
}

export interface CreateRMAResult {
  success: boolean;
  rma?: IRMA;
  error?: string;
}

export interface ApproveRMAParams {
  rmaId: mongoose.Types.ObjectId | string;
  approvedBy: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
  req?: Request;
}

export interface RejectRMAParams {
  rmaId: mongoose.Types.ObjectId | string;
  rejectedBy: mongoose.Types.ObjectId | string;
  reason: string;
  storeId: mongoose.Types.ObjectId | string;
  req?: Request;
}

export interface ReceiveRMAParams {
  rmaId: mongoose.Types.ObjectId | string;
  receivedBy: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
  req?: Request;
}

/**
 * Calculate refund amount for RMA items
 */
async function calculateRefundAmount(
  order: IOrder,
  rmaItems: IRMAItem[]
): Promise<{ refundAmount: number; itemRefunds: Map<string, number> }> {
  const itemRefunds = new Map<string, number>();
  let totalRefund = 0;

  // Get order items map
  const orderItemsMap = new Map(
    order.items
      .filter((item) => item.globalVariantId)
      .map((item) => [item.globalVariantId!.toString(), item])
  );

  // Calculate refund per item
  for (const rmaItem of rmaItems) {
    const variantId = typeof rmaItem.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(rmaItem.globalVariantId)
      : rmaItem.globalVariantId;

    const orderItem = orderItemsMap.get(variantId.toString());
    if (!orderItem) {
      continue;
    }

    // Calculate proportional refund (item price * return quantity / ordered quantity)
    const itemPrice = orderItem.unitPrice || orderItem.totalPrice || 0;
    const returnRatio = rmaItem.quantity / orderItem.quantity;
    let itemRefund = itemPrice * returnRatio;

    // Adjust for return shipping if customer pays
    if (rmaItem.returnShipping && rmaItem.returnShipping.payer === 'customer') {
      itemRefund -= rmaItem.returnShipping.amount;
      // Ensure refund is non-negative
      itemRefund = Math.max(0, itemRefund);
    }

    itemRefunds.set(variantId.toString(), itemRefund);
    totalRefund += itemRefund;

    // Update RMA item with refund amount
    rmaItem.refundAmount = itemRefund;
  }

  // Adjust for tax proportionally (if applicable)
  // Note: Shipping is typically non-refundable unless policy says otherwise
  if (order.taxTotal && order.subtotal) {
    const taxRatio = order.taxTotal / order.subtotal;
    const taxRefund = totalRefund * taxRatio;
    // For simplicity, we'll include tax in the refund
    // In production, you might want to handle tax refunds separately
  }

  return { refundAmount: totalRefund, itemRefunds };
}

/**
 * Reverse inventory for received RMA items
 */
async function reverseInventory(
  rma: IRMA,
  order: IOrder,
  session: ClientSession
): Promise<void> {
  for (const rmaItem of rma.items) {
    const variantId = typeof rmaItem.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(rmaItem.globalVariantId)
      : rmaItem.globalVariantId;

    const originId = typeof rmaItem.originId === 'string'
      ? new mongoose.Types.ObjectId(rmaItem.originId)
      : rmaItem.originId;

    // Only reverse inventory if item is resellable (sealed or opened, not damaged)
    if (rmaItem.condition === 'damaged') {
      // Mark as damaged/loss - don't add back to inventory
      continue;
    }

    // Find origin inventory
    const originInventory = await OriginVariantInventory.findOne({
      originId,
      globalVariantId: variantId,
    }).session(session);

    if (originInventory) {
      // Add stock back to available inventory
      originInventory.availableStock += rmaItem.quantity;
      originInventory.lastUpdatedAt = new Date();
      await originInventory.save({ session });
    }

    // Release any remaining reservations for this item
    const reservations = await InventoryReservation.find({
      orderId: order._id,
      globalVariantId: variantId,
      originId,
      status: 'reserved',
    }).session(session);

    for (const reservation of reservations) {
      if (reservation.quantity <= rmaItem.quantity) {
        reservation.status = 'released';
        reservation.releasedAt = new Date();
        await reservation.save({ session });
      } else {
        // Partial release
        reservation.quantity -= rmaItem.quantity;
        await reservation.save({ session });
      }
    }
  }
}

/**
 * Execute refund based on payment method
 */
async function executeRefund(
  rma: IRMA,
  order: IOrder,
  refundAmount: number,
  session: ClientSession
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    if (order.paymentMethod === 'stripe') {
      // Import Stripe provider
      const { getPaymentProvider } = await import('../payments/paymentProvider');
      const stripeProvider = getPaymentProvider('stripe');

      if (!order.paymentIntentId) {
        return { success: false, error: 'Payment intent ID not found' };
      }

      const refundResult = await stripeProvider.createRefund({
        paymentId: order.paymentIntentId,
        amount: refundAmount,
        reason: `RMA: ${rma.rmaNumber}`,
        metadata: {
          orderId: order.orderId,
          rmaNumber: rma.rmaNumber,
        },
      });

      return {
        success: refundResult.status === 'succeeded',
        refundId: refundResult.refundId,
        error: refundResult.status !== 'succeeded' ? 'Refund failed' : undefined,
      };
    } else if (order.paymentMethod === 'paypal') {
      // Import PayPal provider
      const { getPaymentProvider } = await import('../payments/paymentProvider');
      const paypalProvider = getPaymentProvider('paypal');

      if (!order.paymentIntentId) {
        return { success: false, error: 'PayPal payment ID not found' };
      }

      const refundResult = await paypalProvider.createRefund({
        paymentId: order.paymentIntentId,
        amount: refundAmount,
        reason: `RMA: ${rma.rmaNumber}`,
        metadata: {
          orderId: order.orderId,
          rmaNumber: rma.rmaNumber,
        },
      });

      return {
        success: refundResult.status === 'succeeded',
        refundId: refundResult.refundId,
        error: refundResult.status !== 'succeeded' ? 'Refund failed' : undefined,
      };
    } else if (order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') {
      // COD refunds: wallet credit or future adjustment
      if (rma.refundMethod === 'wallet') {
        // TODO: Implement wallet credit system
        // For now, mark as processed
        return { success: true };
      } else if (rma.refundMethod === 'cod_adjustment') {
        // TODO: Implement COD adjustment system
        // For now, mark as processed
        return { success: true };
      }
    }

    return { success: false, error: 'Unsupported payment method' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate credit note for RMA
 */
async function generateCreditNote(
  rma: IRMA,
  order: IOrder,
  refundAmount: number,
  session: ClientSession
): Promise<mongoose.Types.ObjectId | null> {
  try {
    // Find original invoice
    const { Invoice } = await import('../models/Invoice');
    const customerInvoice = await Invoice.findOne({
      orderId: order.orderId,
      invoiceType: 'customer',
    }).session(session);

    if (!customerInvoice) {
      console.warn(`[RMA] No customer invoice found for order ${order.orderId}`);
      return null;
    }

    // Generate credit note number
    const creditNoteNumber = await generateCreditNoteNumber(order.storeId);

    // Calculate tax refund proportionally
    const taxRefund = order.taxTotal && order.subtotal
      ? (refundAmount / order.subtotal) * order.taxTotal
      : 0;

    // Create credit note
    const creditNote = new CreditNote({
      storeId: order.storeId,
      orderId: order.orderId,
      invoiceId: customerInvoice._id,
      creditNoteNumber,
      invoiceType: 'customer',
      entityId: order.customerEmail || order.customerId?.toString() || '',
      subtotal: -refundAmount, // Negative (item refund)
      taxAmount: -taxRefund, // Negative
      totalAmount: -(refundAmount + taxRefund), // Negative
      reason: `Return: RMA ${rma.rmaNumber}`,
      issuedAt: new Date(),
      status: 'issued',
      metadata: {
        rmaNumber: rma.rmaNumber,
        rmaId: rma._id.toString(),
      },
    });

    await creditNote.save({ session });
    return creditNote._id;
  } catch (error: any) {
    console.error(`[RMA] Failed to generate credit note:`, error);
    return null;
  }
}

/**
 * Create ledger entries for return shipping charges
 */
async function createReturnShippingLedgerEntries(
  rma: IRMA,
  order: IOrder,
  session: ClientSession
): Promise<void> {
  try {
    const paymentSplit = await PaymentSplit.findOne({
      orderId: order.orderId,
    }).session(session);

    if (!paymentSplit) {
      console.warn(`[RMA] No payment split found for order ${order.orderId}`);
      return;
    }

    const now = new Date();

    // For each RMA item with return shipping
    for (const rmaItem of rma.items) {
      if (!rmaItem.returnShipping || rmaItem.returnShipping.payer === 'customer') {
        continue; // Customer pays, no ledger entry needed
      }

      const returnShippingAmount = rmaItem.returnShipping.amount;
      const payer = rmaItem.returnShipping.payer;

      // Create negative ledger entry for return shipping charge
      const ledgerEntry = new PayoutLedger({
        storeId: order.storeId,
        entityType: payer as 'supplier' | 'reseller' | 'platform',
        entityId:
          payer === 'supplier'
            ? paymentSplit.supplierId.toString()
            : payer === 'reseller'
            ? paymentSplit.resellerId
            : 'platform',
        orderId: order.orderId,
        paymentSplitId: paymentSplit._id,
        amount: -returnShippingAmount, // Negative (charge)
        status: 'pending',
        availableAt: now,
        metadata: {
          reason: 'RETURN_SHIPPING',
          rmaNumber: rma.rmaNumber,
          rmaId: rma._id.toString(),
          skuId: rmaItem.globalVariantId.toString(),
          ruleId: rmaItem.returnShipping.ruleSnapshot.ruleId.toString(),
        },
      });

      await ledgerEntry.save({ session });
    }
  } catch (error: any) {
    console.error(`[RMA] Failed to create return shipping ledger entries:`, error);
    // Don't fail the transaction, but log the error
  }
}

/**
 * Adjust payment split for refund
 */
async function adjustPaymentSplit(
  order: IOrder,
  refundAmount: number,
  session: ClientSession
): Promise<void> {
  try {
    const paymentSplit = await PaymentSplit.findOne({
      orderId: order.orderId,
    }).session(session);

    if (!paymentSplit) {
      console.warn(`[RMA] No payment split found for order ${order.orderId}`);
      return;
    }

    // Calculate proportional refunds
    const refundRatio = refundAmount / paymentSplit.totalAmount;

    // Create negative ledger entries (handled by split payment service)
    const { reversePaymentSplit } = await import('./splitPayment.service');
    await reversePaymentSplit(
      order.orderId,
      `RMA refund: ${refundAmount}`,
      'system',
      'system'
    );
  } catch (error: any) {
    console.error(`[RMA] Failed to adjust payment split:`, error);
    // Don't fail the transaction, but log the error
  }
}

/**
 * Create RMA request
 */
export async function createRMA(params: CreateRMAParams): Promise<CreateRMAResult> {
  const { orderId, items, refundMethod, storeId, customerId, req } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  try {
    return await withTransaction(async (session: ClientSession) => {
      // STEP 1: Fetch order
      const order = await Order.findOne({ orderId, storeId: storeObjId }).session(session);

      if (!order) {
        return {
          success: false,
          error: 'Order not found',
        };
      }

      // STEP 2: Validate customer ownership (if customerId provided)
      if (customerId) {
        const customerObjId = typeof customerId === 'string'
          ? new mongoose.Types.ObjectId(customerId)
          : customerId;

        if (order.customerId?.toString() !== customerObjId.toString()) {
          return {
            success: false,
            error: 'Order does not belong to this customer',
          };
        }
      }

      // STEP 3: Validate return eligibility
      const validation = await validateReturn(order, items, storeObjId);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join('; '),
        };
      }

      // STEP 4: Map items to RMA items with origin information
      const rmaItems: IRMAItem[] = [];
      const fulfillmentItems = order.fulfillmentSnapshot?.items || [];

      for (const returnItem of items) {
        const variantId = typeof returnItem.globalVariantId === 'string'
          ? new mongoose.Types.ObjectId(returnItem.globalVariantId)
          : returnItem.globalVariantId;

        // Find fulfillment info for this item
        const fulfillmentItem = fulfillmentItems.find(
          (item) => item.globalVariantId.toString() === variantId.toString()
        );

        if (!fulfillmentItem) {
          return {
            success: false,
            error: `Fulfillment information not found for item ${variantId}`,
          };
        }

        // Find order item for price
        const orderItem = order.items.find(
          (item) => item.globalVariantId?.toString() === variantId.toString()
        );

        rmaItems.push({
          globalVariantId: variantId,
          quantity: returnItem.quantity,
          originId: fulfillmentItem.originId,
          shipmentId: undefined, // TODO: Map to shipment group
          reason: returnItem.reason,
          condition: returnItem.condition,
          originalPrice: orderItem?.unitPrice || orderItem?.totalPrice || 0,
          refundAmount: 0, // Will be calculated later
        });
      }

      // STEP 5: Calculate refund amount
      const { refundAmount } = await calculateRefundAmount(order, rmaItems);

      // STEP 6: Generate RMA number
      const rmaNumber = await generateRMANumber(storeObjId, 'logistics', session);

      // STEP 7: Create RMA
      const rma = new RMA({
        storeId: storeObjId,
        orderId: order._id,
        rmaNumber,
        customerId: customerId
          ? (typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId)
          : order.customerId,
        items: rmaItems,
        status: 'requested',
        refundMethod,
        refundAmount,
        refundStatus: 'pending',
      });

      await rma.save({ session });

      // STEP 8: Audit log
      if (req) {
        await logAudit({
          req,
          action: 'RMA_REQUESTED',
          entityType: 'RMA',
          entityId: rma._id.toString(),
          description: `RMA ${rmaNumber} requested for order ${order.orderNumber || order.orderId}`,
          metadata: {
            rmaNumber,
            orderId: order.orderId,
            itemCount: items.length,
            refundAmount,
            refundMethod,
          },
        });
      }

      // STEP 9: Emit event
      eventStreamEmitter.emit('event', {
        eventType: 'RMA_REQUESTED',
        payload: {
          rmaId: rma._id.toString(),
          rmaNumber,
          orderId: order.orderId,
          itemCount: items.length,
        },
        storeId: storeObjId.toString(),
        occurredAt: new Date(),
      });

      return {
        success: true,
        rma,
      };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create RMA',
    };
  }
}

/**
 * Approve RMA
 */
export async function approveRMA(params: ApproveRMAParams): Promise<{ success: boolean; rma?: IRMA; error?: string }> {
  const { rmaId, approvedBy, storeId, req } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const rmaObjId = typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId;
  const approvedByObjId = typeof approvedBy === 'string' ? new mongoose.Types.ObjectId(approvedBy) : approvedBy;

  try {
    return await withTransaction(async (session: ClientSession) => {
      const rma = await RMA.findOne({ _id: rmaObjId, storeId: storeObjId }).session(session);

      if (!rma) {
        return {
          success: false,
          error: 'RMA not found',
        };
      }

      if (rma.status !== 'requested') {
        return {
          success: false,
          error: `RMA cannot be approved. Current status: ${rma.status}`,
        };
      }

      // STEP 1: Fetch order for shipping snapshot and addresses
      if (!rma.orderId) {
        return {
          success: false,
          error: 'RMA does not have an associated order',
        };
      }
      const order = await Order.findById(rma.orderId).session(session);
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
        };
      }

      // STEP 2: For each RMA item, resolve return shipping rule and calculate cost
      for (const rmaItem of rma.items) {
        const variantId =
          typeof rmaItem.globalVariantId === 'string'
            ? new mongoose.Types.ObjectId(rmaItem.globalVariantId)
            : rmaItem.globalVariantId;

        // Get variant to find category
        const variant = await ProductVariant.findById(variantId)
          .populate('productId', 'categoryId')
          .lean();

        const categoryId = (variant?.productId as any)?.categoryId;

        // Resolve return shipping rule
        const ruleResult = await resolveReturnShippingRule({
          storeId: storeObjId,
          skuId: variantId,
          categoryId: categoryId,
          reason: rmaItem.reason,
          condition: rmaItem.condition,
        });

        let rule = ruleResult.rule;

        // Fallback to global rule if no match
        if (!rule) {
          rule = await getFallbackGlobalRule(storeObjId);
        }

        if (rule) {
          // Calculate return shipping cost
          const returnShippingCalc = await calculateReturnShipping({
            rule,
            originalShippingSnapshot: order.shippingSnapshot || null,
            rmaItem: {
              globalVariantId: variantId,
              quantity: rmaItem.quantity,
              originId: rmaItem.originId,
            },
            order,
            customerAddress: order.shippingAddress || {
              country: '',
              state: '',
              city: '',
              zip: '',
            },
            storeId: storeObjId,
          });

          // Store snapshot in RMA item (frozen at approval)
          rmaItem.returnShipping = {
            payer: returnShippingCalc.payer,
            amount: returnShippingCalc.amount,
            ruleSnapshot: returnShippingCalc.ruleSnapshot,
          };

          // Audit log
          if (req) {
            await logAudit({
              req,
              action: 'RETURN_SHIPPING_RULE_APPLIED',
              entityType: 'RMA',
              entityId: rma._id.toString(),
              description: `Return shipping rule applied for item ${variantId}`,
              metadata: {
                rmaNumber: rma.rmaNumber,
                skuId: variantId.toString(),
                payer: returnShippingCalc.payer,
                amount: returnShippingCalc.amount,
                ruleId: rule._id.toString(),
                scope: rule.scope,
              },
            });
          }
        }
      }

      // Update RMA status
      rma.status = 'approved';
      rma.approvedBy = approvedByObjId;
      rma.approvedAt = new Date();
      await rma.save({ session });

      // Audit log
      if (req) {
        await logAudit({
          req,
          action: 'RMA_APPROVED',
          entityType: 'RMA',
          entityId: rma._id.toString(),
          description: `RMA ${rma.rmaNumber} approved`,
          metadata: {
            rmaNumber: rma.rmaNumber,
            orderId: rma.orderId?.toString() || null,
            approvedBy: approvedByObjId.toString(),
          },
        });
      }

      // Emit event
      eventStreamEmitter.emit('event', {
        eventType: 'RMA_APPROVED',
        payload: {
          rmaId: rma._id.toString(),
          rmaNumber: rma.rmaNumber,
        },
        storeId: storeObjId.toString(),
        occurredAt: new Date(),
      });

      return {
        success: true,
        rma,
      };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to approve RMA',
    };
  }
}

/**
 * Reject RMA
 */
export async function rejectRMA(params: RejectRMAParams): Promise<{ success: boolean; rma?: IRMA; error?: string }> {
  const { rmaId, rejectedBy, reason, storeId, req } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const rmaObjId = typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId;
  const rejectedByObjId = typeof rejectedBy === 'string' ? new mongoose.Types.ObjectId(rejectedBy) : rejectedBy;

  try {
    return await withTransaction(async (session: ClientSession) => {
      const rma = await RMA.findOne({ _id: rmaObjId, storeId: storeObjId }).session(session);

      if (!rma) {
        return {
          success: false,
          error: 'RMA not found',
        };
      }

      if (rma.status !== 'requested') {
        return {
          success: false,
          error: `RMA cannot be rejected. Current status: ${rma.status}`,
        };
      }

      // Update RMA status
      rma.status = 'rejected';
      rma.rejectedBy = rejectedByObjId;
      rma.rejectedAt = new Date();
      rma.rejectionReason = reason;
      await rma.save({ session });

      // Audit log
      if (req) {
        await logAudit({
          req,
          action: 'RMA_REJECTED',
          entityType: 'RMA',
          entityId: rma._id.toString(),
          description: `RMA ${rma.rmaNumber} rejected: ${reason}`,
          metadata: {
            rmaNumber: rma.rmaNumber,
            orderId: rma.orderId?.toString() || null,
            rejectedBy: rejectedByObjId.toString(),
            reason,
          },
        });
      }

      // Emit event
      eventStreamEmitter.emit('event', {
        eventType: 'RMA_REJECTED',
        payload: {
          rmaId: rma._id.toString(),
          rmaNumber: rma.rmaNumber,
          reason,
        },
        storeId: storeObjId.toString(),
        occurredAt: new Date(),
      });

      return {
        success: true,
        rma,
      };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to reject RMA',
    };
  }
}

/**
 * Receive RMA items (inventory reversal + refund)
 */
export async function receiveRMA(params: ReceiveRMAParams): Promise<{ success: boolean; rma?: IRMA; error?: string }> {
  const { rmaId, receivedBy, storeId, req } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const rmaObjId = typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId;

  try {
    return await withTransaction(async (session: ClientSession) => {
      const rma = await RMA.findOne({ _id: rmaObjId, storeId: storeObjId })
        .populate('orderId')
        .session(session);

      if (!rma) {
        return {
          success: false,
          error: 'RMA not found',
        };
      }

      if (rma.status !== 'picked_up' && rma.status !== 'approved') {
        return {
          success: false,
          error: `RMA cannot be received. Current status: ${rma.status}`,
        };
      }

      if (!rma.orderId) {
        return {
          success: false,
          error: 'RMA does not have an associated order',
        };
      }
      const order = await Order.findById(rma.orderId).session(session);
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
        };
      }

      // STEP 1: Reverse inventory
      await reverseInventory(rma, order, session);

      // STEP 2: Calculate refund amount
      const { refundAmount } = await calculateRefundAmount(order, rma.items);

      // STEP 3: Execute refund
      const refundResult = await executeRefund(rma, order, refundAmount, session);

      if (!refundResult.success && rma.refundMethod !== 'cod_adjustment') {
        // For COD adjustments, we don't need immediate refund
        return {
          success: false,
          error: refundResult.error || 'Refund execution failed',
        };
      }

      // STEP 4: Generate credit note
      const creditNoteId = await generateCreditNote(rma, order, refundAmount, session);

      // STEP 5: Create ledger entries for return shipping charges (if not customer-paid)
      await createReturnShippingLedgerEntries(rma, order, session);

      // STEP 6: Adjust payment split for refund
      await adjustPaymentSplit(order, refundAmount, session);

      // STEP 6: Update RMA status
      rma.status = 'received';
      rma.receivedAt = new Date();
      rma.refundStatus = refundResult.success ? 'completed' : 'pending';
      if (creditNoteId) {
        rma.creditNoteId = creditNoteId;
      }
      await rma.save({ session });

      // STEP 7: Update order status if all items returned
      const totalReturnedQuantity = rma.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalOrderQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

      if (totalReturnedQuantity >= totalOrderQuantity) {
        // All items returned - mark order as returned
        order.orderStatus = 'returned';
        await order.save({ session });
      } else {
        // Partial return
        order.orderStatus = 'partially_returned' as any; // TODO: Add to OrderStatus enum
        await order.save({ session });
      }

      // STEP 8: Audit log
      if (req) {
        await logAudit({
          req,
          action: 'RMA_RECEIVED',
          entityType: 'RMA',
          entityId: rma._id.toString(),
          description: `RMA ${rma.rmaNumber} received and refunded`,
          metadata: {
            rmaNumber: rma.rmaNumber,
            orderId: order.orderId,
            refundAmount,
            creditNoteId: creditNoteId?.toString(),
          },
        });
      }

      // STEP 9: Emit event
      eventStreamEmitter.emit('event', {
        eventType: 'RMA_RECEIVED',
        payload: {
          rmaId: rma._id.toString(),
          rmaNumber: rma.rmaNumber,
          refundAmount,
        },
        storeId: storeObjId.toString(),
        occurredAt: new Date(),
      });

      return {
        success: true,
        rma,
      };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to receive RMA',
    };
  }
}

