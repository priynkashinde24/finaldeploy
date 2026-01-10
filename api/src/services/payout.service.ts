import mongoose from 'mongoose';
import { PayoutLedger, IPayoutLedger } from '../models/PayoutLedger';
import { Order } from '../models/Order';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';

/**
 * Payout Service
 * 
 * PURPOSE:
 * - Get eligible payouts
 * - Mark payouts as paid
 * - Support delayed payouts
 * - Future-proof for Stripe Connect, PayPal Payouts, manual bank transfers
 * 
 * ELIGIBILITY RULES:
 * - Order delivered (or confirmed)
 * - No return / refund window active
 * - availableAt reached
 */

export interface GetEligiblePayoutsParams {
  entityType: 'supplier' | 'reseller' | 'platform';
  entityId: string;
  storeId?: string;
  limit?: number;
  offset?: number;
}

export interface MarkAsPaidParams {
  payoutId: string;
  payoutReference: string; // External payout reference (Stripe transfer ID, PayPal payout ID, etc.)
  actorId?: string;
  actorRole?: 'admin' | 'supplier' | 'reseller' | 'system';
}

/**
 * Get eligible payouts for an entity
 * 
 * Eligible when:
 * - availableAt reached
 * - status is 'pending' or 'eligible'
 * - Order is delivered/confirmed (optional check)
 */
export async function getEligiblePayouts(
  params: GetEligiblePayoutsParams
): Promise<{ payouts: IPayoutLedger[]; total: number }> {
  const { entityType, entityId, storeId, limit = 100, offset = 0 } = params;

  const query: any = {
    entityType,
    entityId,
    status: { $in: ['pending', 'eligible'] },
    availableAt: { $lte: new Date() },
  };

  if (storeId) {
    query.storeId = new mongoose.Types.ObjectId(storeId);
  }

  const payouts = await PayoutLedger.find(query)
    .sort({ availableAt: 1, createdAt: 1 })
    .limit(limit)
    .skip(offset)
    .populate('paymentSplitId')
    .lean();

  const total = await PayoutLedger.countDocuments(query);

  // Optional: Check if orders are delivered/confirmed
  // This can be enhanced based on business requirements
  const validatedPayouts: IPayoutLedger[] = [];
  for (const payout of payouts) {
    const order = await Order.findOne({ orderId: payout.orderId });
    
    // If order doesn't exist or is cancelled, skip
    if (!order || order.status === 'cancelled') {
      continue;
    }

    // For now, we consider order 'paid' as eligible
    // Can be enhanced to check delivery status, return window, etc.
    if (order.status === 'paid') {
      validatedPayouts.push(payout as IPayoutLedger);
    }
  }

  return {
    payouts: validatedPayouts,
    total,
  };
}

/**
 * Mark payout as paid
 * 
 * This updates the ledger entry status and records the payout reference.
 * Actual money transfer is handled separately (Stripe Connect, PayPal Payouts, manual bank transfer).
 */
export async function markAsPaid(params: MarkAsPaidParams): Promise<{ success: boolean; error?: string }> {
  const { payoutId, payoutReference, actorId, actorRole = 'system' } = params;

  try {
    const payout = await PayoutLedger.findById(payoutId);

    if (!payout) {
      return {
        success: false,
        error: 'Payout not found',
      };
    }

    if (payout.status === 'paid') {
      return {
        success: false,
        error: 'Payout already marked as paid',
      };
    }

    if (payout.availableAt > new Date()) {
      return {
        success: false,
        error: 'Payout is not yet eligible (availableAt not reached)',
      };
    }

    // Update payout status
    payout.status = 'paid';
    payout.paidAt = new Date();
    payout.payoutReference = payoutReference;
    await payout.save();

    // Update PaymentSplit status to settled if all ledger entries are paid
    if (payout.paymentSplitId) {
      const { PaymentSplit } = await import('../models/PaymentSplit');
      const split = await PaymentSplit.findById(payout.paymentSplitId);

      if (split) {
        // Check if all ledger entries for this order are paid
        const allLedgerEntries = await PayoutLedger.find({
          orderId: payout.orderId,
        });

        const allPaid = allLedgerEntries.every(entry => entry.status === 'paid');

        if (allPaid && split.status !== 'settled') {
          split.status = 'settled';
          await split.save();
        }
      }
    }

    // Emit event
    eventStreamEmitter.emit('event', {
      eventType: 'payout.paid',
      payload: {
        payoutId: payout._id.toString(),
        orderId: payout.orderId,
        entityType: payout.entityType,
        entityId: payout.entityId,
        amount: payout.amount,
        payoutReference,
      },
      storeId: payout.storeId.toString(),
      occurredAt: new Date(),
    });

    // Audit log
    await logAudit({
      storeId: payout.storeId.toString(),
      actorId,
      actorRole,
      action: 'PAYOUT_PAID',
      entityType: 'PayoutLedger',
      entityId: payout._id.toString(),
      description: `Payout marked as paid for ${payout.entityType} ${payout.entityId}`,
      before: {
        status: payout.status,
        payoutReference: null,
      },
      after: {
        status: 'paid',
        payoutReference,
        paidAt: new Date(),
      },
      metadata: {
        orderId: payout.orderId,
        amount: payout.amount,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[PAYOUT SERVICE] Error marking payout as paid:`, error);
    return {
      success: false,
      error: error.message || 'Failed to mark payout as paid',
    };
  }
}

/**
 * Get payout summary for an entity
 */
export async function getPayoutSummary(
  entityType: 'supplier' | 'reseller' | 'platform',
  entityId: string,
  storeId?: string
): Promise<{
  pending: number;
  eligible: number;
  paid: number;
  total: number;
}> {
  const query: any = {
    entityType,
    entityId,
  };

  if (storeId) {
    query.storeId = new mongoose.Types.ObjectId(storeId);
  }

  const [pending, eligible, paid, total] = await Promise.all([
    PayoutLedger.aggregate([
      { $match: { ...query, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    PayoutLedger.aggregate([
      {
        $match: {
          ...query,
          status: 'eligible',
          availableAt: { $lte: new Date() },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    PayoutLedger.aggregate([
      { $match: { ...query, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    PayoutLedger.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    pending: pending[0]?.total || 0,
    eligible: eligible[0]?.total || 0,
    paid: paid[0]?.total || 0,
    total: total[0]?.total || 0,
  };
}

