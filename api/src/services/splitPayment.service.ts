import mongoose from 'mongoose';
import { IOrder } from '../models/Order';
import { PaymentSplit, IPaymentSplit } from '../models/PaymentSplit';
import { PayoutLedger, IPayoutLedger } from '../models/PayoutLedger';
import { calculateSplit, SplitCalculationResult } from '../utils/splitCalculator';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';
import { withTransaction } from '../utils/withTransaction';

/**
 * Split Payment Service
 * 
 * PURPOSE:
 * - Create payment split on payment confirmation
 * - Populate payout ledger
 * - Ensure idempotency
 * - Full audit trail
 * 
 * RULES:
 * - Never create split before payment confirmation
 * - One split per order (enforced by unique constraint)
 * - Split is locked immediately after creation
 * - Ledger entries created for supplier, reseller, and platform
 */

export interface CreateSplitParams {
  order: IOrder;
  paymentId?: mongoose.Types.ObjectId;
  paymentMethod: 'stripe' | 'paypal' | 'cod' | 'cod_partial' | 'crypto';
  platformCommissionPercent?: number;
  settlementDelayDays?: number; // Days until payout becomes eligible (default: 7)
  actorId?: string;
  actorRole?: 'admin' | 'supplier' | 'reseller' | 'system';
}

export interface CreateSplitResult {
  success: boolean;
  split?: IPaymentSplit;
  ledgerEntries?: IPayoutLedger[];
  error?: string;
}

/**
 * Create payment split and populate payout ledger
 * 
 * This function is idempotent - if split already exists, returns existing split
 */
export async function createPaymentSplit(params: CreateSplitParams): Promise<CreateSplitResult> {
  const {
    order,
    paymentId,
    paymentMethod,
    platformCommissionPercent = 5,
    settlementDelayDays = 7,
    actorId,
    actorRole = 'system',
  } = params;

  // Get tier-based payout delay if available
  let actualSettlementDelayDays = settlementDelayDays;
  try {
    const { getPayoutDelayDays } = await import('./kycTier.service');
    if (order.supplierId) {
      const tierPayoutDelay = await getPayoutDelayDays(new mongoose.Types.ObjectId(order.supplierId.toString()));
      if (tierPayoutDelay !== undefined) {
        actualSettlementDelayDays = tierPayoutDelay;
      }
    }
  } catch (error) {
    // Tier service not available - use default delay
    console.warn('[SPLIT PAYMENT] Tier payout delay check failed, using default:', error);
  }

  try {
    return await withTransaction(async (session) => {
      // Check if split already exists (idempotency)
      const existingSplit = await PaymentSplit.findOne({
        orderId: order.orderId,
      }).session(session);

      if (existingSplit) {
        console.log(`[SPLIT PAYMENT] Split already exists for order ${order.orderId}`);
        
        // Return existing split and ledger entries
        const ledgerEntries = await PayoutLedger.find({
          orderId: order.orderId,
        }).session(session);

        return {
          success: true,
          split: existingSplit,
          ledgerEntries,
        };
      }

      // STEP 1: Get tier-based commission rate if available
      let actualCommissionPercent = platformCommissionPercent;
      try {
        const { getCommissionRate } = await import('./kycTier.service');
        if (order.supplierId) {
          const tierCommissionRate = await getCommissionRate(new mongoose.Types.ObjectId(order.supplierId.toString()));
          if (tierCommissionRate !== undefined) {
            actualCommissionPercent = tierCommissionRate;
          }
        }
      } catch (error) {
        // Tier service not available - use default commission
        console.warn('[SPLIT PAYMENT] Tier commission check failed, using default:', error);
      }

      // STEP 1: Calculate split
      const splitCalculation = await calculateSplit(order, actualCommissionPercent);

      // STEP 2: Create PaymentSplit record
      const paymentSplit = new PaymentSplit({
        storeId: order.storeId,
        orderId: order.orderId,
        paymentId,
        totalAmount: splitCalculation.totalAmount,
        supplierId: splitCalculation.supplierId,
        supplierAmount: splitCalculation.supplierAmount,
        resellerId: splitCalculation.resellerId,
        resellerAmount: splitCalculation.resellerAmount,
        platformAmount: splitCalculation.platformAmount,
        status: 'pending',
        paymentMethod,
      metadata: {
        platformCommissionPercent: actualCommissionPercent,
        settlementDelayDays: actualSettlementDelayDays,
        tierCommissionRate: actualCommissionPercent !== platformCommissionPercent ? actualCommissionPercent : undefined,
        tierPayoutDelay: actualSettlementDelayDays !== settlementDelayDays ? actualSettlementDelayDays : undefined,
      },
      });

      await paymentSplit.save({ session });

      // STEP 3: Lock split (immutable after this)
      paymentSplit.status = 'locked';
      await paymentSplit.save({ session });

      // STEP 4: Create ledger entries
      const now = new Date();
      const availableAt = new Date(now);
      availableAt.setDate(availableAt.getDate() + actualSettlementDelayDays);

      const ledgerEntries: IPayoutLedger[] = [];

      // Supplier ledger entry
      const supplierLedger = new PayoutLedger({
        storeId: order.storeId,
        entityType: 'supplier',
        entityId: splitCalculation.supplierId.toString(),
        orderId: order.orderId,
        paymentSplitId: paymentSplit._id,
        amount: splitCalculation.supplierAmount,
        status: 'pending',
        availableAt,
        metadata: {
          paymentMethod,
        },
      });
      await supplierLedger.save({ session });
      ledgerEntries.push(supplierLedger);

      // Reseller ledger entry
      const resellerLedger = new PayoutLedger({
        storeId: order.storeId,
        entityType: 'reseller',
        entityId: splitCalculation.resellerId,
        orderId: order.orderId,
        paymentSplitId: paymentSplit._id,
        amount: splitCalculation.resellerAmount,
        status: 'pending',
        availableAt,
        metadata: {
          paymentMethod,
        },
      });
      await resellerLedger.save({ session });
      ledgerEntries.push(resellerLedger);

      // Platform ledger entry
      const platformLedger = new PayoutLedger({
        storeId: order.storeId,
        entityType: 'platform',
        entityId: 'platform',
        orderId: order.orderId,
        paymentSplitId: paymentSplit._id,
        amount: splitCalculation.platformAmount,
        status: 'pending',
        availableAt,
        metadata: {
          paymentMethod,
          platformCommissionPercent,
        },
      });
      await platformLedger.save({ session });
      ledgerEntries.push(platformLedger);

      // STEP 5: Emit PAYMENT_SPLIT_CREATED event
      eventStreamEmitter.emit('event', {
        eventType: 'payment.split.created',
        payload: {
          orderId: order.orderId,
          storeId: order.storeId.toString(),
          splitId: paymentSplit._id.toString(),
          totalAmount: splitCalculation.totalAmount,
          supplierAmount: splitCalculation.supplierAmount,
          resellerAmount: splitCalculation.resellerAmount,
          platformAmount: splitCalculation.platformAmount,
          paymentMethod,
        },
        storeId: order.storeId.toString(),
        userId: order.customerEmail || undefined,
        occurredAt: new Date(),
      });

      // STEP 6: Audit log
      await logAudit({
        storeId: order.storeId.toString(),
        actorId,
        actorRole,
        action: 'PAYMENT_SPLIT_CREATED',
        entityType: 'PaymentSplit',
        entityId: paymentSplit._id.toString(),
        description: `Payment split created for order ${order.orderId}`,
        after: {
          orderId: order.orderId,
          totalAmount: splitCalculation.totalAmount,
          supplierAmount: splitCalculation.supplierAmount,
          resellerAmount: splitCalculation.resellerAmount,
          platformAmount: splitCalculation.platformAmount,
          paymentMethod,
        },
        metadata: {
          paymentId: paymentId?.toString(),
          platformCommissionPercent,
          settlementDelayDays,
        },
      });

      return {
        success: true,
        split: paymentSplit,
        ledgerEntries,
      };
    });
  } catch (error: any) {
    console.error(`[SPLIT PAYMENT] Error creating split for order ${order.orderId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to create payment split',
    };
  }
}

/**
 * Reverse payment split (for refunds)
 * Creates negative ledger entries
 */
export async function reversePaymentSplit(
  orderId: string,
  reason: string,
  actorId?: string,
  actorRole: 'admin' | 'supplier' | 'reseller' | 'system' = 'system'
): Promise<{ success: boolean; error?: string }> {
  try {
    return await withTransaction(async (session) => {
      const split = await PaymentSplit.findOne({ orderId }).session(session);
      
      if (!split) {
        return {
          success: false,
          error: `Payment split not found for order ${orderId}`,
        };
      }

      // Check if already reversed
      const existingReversals = await PayoutLedger.find({
        orderId,
        amount: { $lt: 0 },
      }).session(session);

      if (existingReversals.length > 0) {
        console.log(`[SPLIT PAYMENT] Split already reversed for order ${orderId}`);
        return { success: true };
      }

      // Create negative ledger entries
      const now = new Date();
      const ledgerEntries: IPayoutLedger[] = [];

      // Reverse supplier
      const supplierReversal = new PayoutLedger({
        storeId: split.storeId,
        entityType: 'supplier',
        entityId: split.supplierId.toString(),
        orderId,
        paymentSplitId: split._id,
        amount: -split.supplierAmount,
        status: 'pending',
        availableAt: now,
        metadata: {
          reason,
          reversal: true,
        },
      });
      await supplierReversal.save({ session });
      ledgerEntries.push(supplierReversal);

      // Reverse reseller
      const resellerReversal = new PayoutLedger({
        storeId: split.storeId,
        entityType: 'reseller',
        entityId: split.resellerId,
        orderId,
        paymentSplitId: split._id,
        amount: -split.resellerAmount,
        status: 'pending',
        availableAt: now,
        metadata: {
          reason,
          reversal: true,
        },
      });
      await resellerReversal.save({ session });
      ledgerEntries.push(resellerReversal);

      // Reverse platform
      const platformReversal = new PayoutLedger({
        storeId: split.storeId,
        entityType: 'platform',
        entityId: 'platform',
        orderId,
        paymentSplitId: split._id,
        amount: -split.platformAmount,
        status: 'pending',
        availableAt: now,
        metadata: {
          reason,
          reversal: true,
        },
      });
      await platformReversal.save({ session });
      ledgerEntries.push(platformReversal);

      // Update split status to settled (if not already)
      if (split.status !== 'settled') {
        split.status = 'settled';
        await split.save({ session });
      }

      // Emit event
      eventStreamEmitter.emit('event', {
        eventType: 'payment.split.reversed',
        payload: {
          orderId,
          storeId: split.storeId.toString(),
          splitId: split._id.toString(),
          reason,
        },
        storeId: split.storeId.toString(),
        occurredAt: new Date(),
      });

      // Audit log
      await logAudit({
        storeId: split.storeId.toString(),
        actorId,
        actorRole,
        action: 'SPLIT_REVERSED',
        entityType: 'PaymentSplit',
        entityId: split._id.toString(),
        description: `Payment split reversed for order ${orderId}: ${reason}`,
        metadata: {
          reason,
          reversedAmounts: {
            supplier: -split.supplierAmount,
            reseller: -split.resellerAmount,
            platform: -split.platformAmount,
          },
        },
      });

      return { success: true };
    });
  } catch (error: any) {
    console.error(`[SPLIT PAYMENT] Error reversing split for order ${orderId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to reverse payment split',
    };
  }
}

