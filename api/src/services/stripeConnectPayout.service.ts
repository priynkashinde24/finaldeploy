import { stripe } from '../lib/stripe';
import { StripeConnectAccount } from '../models/StripeConnectAccount';
import { PayoutLedger, IPayoutLedger } from '../models/PayoutLedger';
import { StripeTransfer } from '../models/StripeTransfer';
import { logAudit } from '../utils/auditLogger';
import { markAsPaid } from './payout.service';
import { eventStreamEmitter } from '../controllers/eventController';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';

/**
 * Stripe Connect Payout Service (Ledger-Based)
 * 
 * PURPOSE:
 * - Transfer funds to supplier/reseller Connect accounts from PayoutLedger
 * - Handle payout processing with idempotency
 * - Track transfer status
 * - Integrates with new ledger system
 * 
 * FLOW:
 * 1. Get eligible payout from PayoutLedger
 * 2. Verify Stripe Connect account exists and is enabled
 * 3. Create Stripe transfer
 * 4. Mark ledger entry as paid
 * 5. Audit log
 */

export interface ProcessPayoutParams {
  payoutLedgerId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
  actorId?: string;
  actorRole?: 'admin' | 'supplier' | 'reseller' | 'system';
}

export interface ProcessPayoutResult {
  success: boolean;
  transferId?: string;
  payoutReference?: string;
  error?: string;
}

/**
 * Process payout from PayoutLedger via Stripe Connect
 * 
 * This function:
 * - Gets eligible payout from ledger
 * - Creates Stripe transfer
 * - Marks ledger entry as paid
 * - Is idempotent (safe to retry)
 */
export async function processPayoutFromLedger(
  params: ProcessPayoutParams
): Promise<ProcessPayoutResult> {
  try {
    const payoutLedgerId =
      typeof params.payoutLedgerId === 'string'
        ? new mongoose.Types.ObjectId(params.payoutLedgerId)
        : params.payoutLedgerId;
    const storeId =
      typeof params.storeId === 'string' ? new mongoose.Types.ObjectId(params.storeId) : params.storeId;

    return await withTransaction(async (session) => {
      // STEP 1: Get payout ledger entry
      const payout = await PayoutLedger.findById(payoutLedgerId).session(session);
      
      if (!payout) {
        return { success: false, error: 'Payout ledger entry not found' };
      }

      // STEP 2: Validate eligibility
      if (payout.status === 'paid') {
        // Already paid - return existing payout reference
        return {
          success: true,
          transferId: payout.payoutReference || undefined,
          payoutReference: payout.payoutReference || undefined,
        };
      }

      if (payout.status !== 'eligible' && payout.status !== 'pending') {
        return { success: false, error: `Payout status is ${payout.status}, cannot process` };
      }

      if (payout.availableAt > new Date()) {
        return { success: false, error: 'Payout is not yet eligible (availableAt not reached)' };
      }

      // STEP 3: Validate entity type (only suppliers and resellers can use Stripe Connect)
      if (payout.entityType === 'platform') {
        return { success: false, error: 'Platform payouts are not processed via Stripe Connect' };
      }

      // STEP 4: Get Stripe Connect account
      const entityId = payout.entityType === 'supplier' 
        ? new mongoose.Types.ObjectId(payout.entityId)
        : payout.entityId; // Reseller ID is string

      const connectAccount = await StripeConnectAccount.findOne({
        storeId,
        supplierId: entityId,
      }).session(session);

      if (!connectAccount) {
        return {
          success: false,
          error: `Stripe Connect account not found for ${payout.entityType} ${payout.entityId}`,
        };
      }

      if (!connectAccount.payoutsEnabled) {
        return { success: false, error: 'Payouts not enabled for this Connect account' };
      }

      if (connectAccount.accountStatus !== 'enabled') {
        return {
          success: false,
          error: `Connect account status is ${connectAccount.accountStatus}, must be enabled`,
        };
      }

      // STEP 5: Validate amount
      if (payout.amount <= 0) {
        return { success: false, error: 'Payout amount must be greater than 0' };
      }

      // STEP 6: Create Stripe transfer
      const transferAmount = Math.round(payout.amount * 100); // Convert to cents
      
      const transfer = await stripe.transfers.create(
        {
          amount: transferAmount,
          currency: 'usd', // TODO: Make configurable
          destination: connectAccount.stripeAccountId,
          metadata: {
            payoutLedgerId: payout._id.toString(),
            orderId: payout.orderId,
            entityType: payout.entityType,
            entityId: payout.entityId,
            storeId: storeId.toString(),
          },
        },
        {
          idempotencyKey: `payout_ledger_${payout._id.toString()}`,
        }
      );

      // STEP 7: Create transfer record
      const transferRecord = new StripeTransfer({
        storeId,
        transferId: transfer.id,
        stripeTransferId: transfer.id, // Legacy field
        destination: connectAccount.stripeAccountId,
        stripeAccountId: connectAccount.stripeAccountId,
        payoutLedgerId: payout._id,
        entityType: payout.entityType,
        entityId: payout.entityId,
        orderId: payout.orderId,
        amount: transferAmount,
        currency: 'usd',
        status: transfer.reversed ? 'reversed' : 'paid',
        metadata: {
          payoutLedgerId: payout._id.toString(),
          orderId: payout.orderId,
          entityType: payout.entityType,
          entityId: payout.entityId,
        },
      });

      await transferRecord.save({ session });

      // STEP 8: Mark ledger entry as paid
      const markPaidResult = await markAsPaid({
        payoutId: payout._id.toString(),
        payoutReference: transfer.id,
        actorId: params.actorId,
        actorRole: params.actorRole || 'system',
      });

      if (!markPaidResult.success) {
        // This shouldn't happen, but if it does, log it
        console.error(
          `[STRIPE CONNECT PAYOUT] Failed to mark payout as paid: ${markPaidResult.error}`
        );
      }

      // STEP 9: Emit event
      eventStreamEmitter.emit('event', {
        eventType: 'payout.processed',
        payload: {
          payoutId: payout._id.toString(),
          orderId: payout.orderId,
          entityType: payout.entityType,
          entityId: payout.entityId,
          amount: payout.amount,
          transferId: transfer.id,
          stripeAccountId: connectAccount.stripeAccountId,
        },
        storeId: storeId.toString(),
        occurredAt: new Date(),
      });

      // STEP 10: Audit log
      await logAudit({
        storeId: storeId.toString(),
        actorId: params.actorId,
        actorRole: params.actorRole || 'system',
        action: 'STRIPE_CONNECT_PAYOUT_PROCESSED',
        entityType: 'PayoutLedger',
        entityId: payout._id.toString(),
        description: `Stripe Connect payout processed for ${payout.entityType} ${payout.entityId}`,
        before: {
          status: payout.status,
          payoutReference: null,
        },
        after: {
          status: 'paid',
          payoutReference: transfer.id,
          transferId: transfer.id,
        },
        metadata: {
          orderId: payout.orderId,
          amount: payout.amount,
          stripeAccountId: connectAccount.stripeAccountId,
        },
      });

      return {
        success: true,
        transferId: transfer.id,
        payoutReference: transfer.id,
      };
    });
  } catch (error: any) {
    console.error(`[STRIPE CONNECT PAYOUT] Error processing payout:`, error);
    return {
      success: false,
      error: error.message || 'Failed to process payout',
    };
  }
}

/**
 * Process all eligible payouts for an entity
 * 
 * Useful for batch processing or scheduled jobs
 */
export async function processEligiblePayoutsForEntity(
  entityType: 'supplier' | 'reseller',
  entityId: string,
  storeId: string,
  limit: number = 50
): Promise<{
  processed: number;
  failed: number;
  results: ProcessPayoutResult[];
}> {
  const { getEligiblePayouts } = await import('./payout.service');
  
  const { payouts } = await getEligiblePayouts({
    entityType,
    entityId,
    storeId,
    limit,
  });

  const results: ProcessPayoutResult[] = [];
  let processed = 0;
  let failed = 0;

  for (const payout of payouts) {
    // Only process positive amounts (skip refunds/reversals)
    if (payout.amount <= 0) {
      continue;
    }

    const result = await processPayoutFromLedger({
      payoutLedgerId: payout._id.toString(),
      storeId,
      actorRole: 'system',
    });

    results.push(result);

    if (result.success) {
      processed++;
    } else {
      failed++;
      console.error(
        `[STRIPE CONNECT PAYOUT] Failed to process payout ${payout._id}: ${result.error}`
      );
    }
  }

  return {
    processed,
    failed,
    results,
  };
}

/**
 * Legacy function for backward compatibility
 * Processes payout from old SupplierPayout model
 */
export async function processSupplierPayout(
  params: {
    supplierPayoutId: mongoose.Types.ObjectId | string;
    storeId: mongoose.Types.ObjectId | string;
  }
): Promise<ProcessPayoutResult> {
  // This is for backward compatibility with old SupplierPayout model
  // In the future, this should be deprecated in favor of processPayoutFromLedger
  console.warn(
    '[STRIPE CONNECT PAYOUT] processSupplierPayout is deprecated. Use processPayoutFromLedger with PayoutLedger instead.'
  );

  // Try to find corresponding ledger entry
  const { SupplierPayout } = await import('../models/SupplierPayout');
  const supplierPayoutId =
    typeof params.supplierPayoutId === 'string'
      ? new mongoose.Types.ObjectId(params.supplierPayoutId)
      : params.supplierPayoutId;

  const supplierPayout = await SupplierPayout.findById(supplierPayoutId);
  if (!supplierPayout) {
    return { success: false, error: 'Supplier payout not found' };
  }

  // Find ledger entry by orderId
  const ledgerEntry = await PayoutLedger.findOne({
    orderId: supplierPayout.orderId,
    entityType: 'supplier',
    entityId: supplierPayout.supplierId.toString(),
  });

  if (ledgerEntry) {
    // Use new ledger-based system
    return processPayoutFromLedger({
      payoutLedgerId: ledgerEntry._id,
      storeId: params.storeId,
      actorRole: 'system',
    });
  }

  // Fallback to old system (if no ledger entry exists)
  return { success: false, error: 'Legacy payout system deprecated. Please use PayoutLedger.' };
}
