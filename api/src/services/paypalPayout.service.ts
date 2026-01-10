import { paypalClient } from '../lib/paypal';
import { SupplierPayout } from '../models/SupplierPayout';
import { PayPalPayout } from '../models/PayPalPayout';
import { logAudit } from '../utils/auditLogger';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import paypal from '@paypal/checkout-server-sdk';

/**
 * PayPal Payout Service
 * 
 * PURPOSE:
 * - Transfer funds to suppliers via PayPal Payouts
 * - Handle payout processing
 * - Track transfer status
 */

export interface ProcessPayoutParams {
  supplierPayoutId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
}

export interface ProcessPayoutResult {
  success: boolean;
  payoutId?: string;
  error?: string;
}

/**
 * Process payout to supplier via PayPal Payouts
 */
export async function processSupplierPayout(
  params: ProcessPayoutParams
): Promise<ProcessPayoutResult> {
  try {
    const supplierPayoutId =
      typeof params.supplierPayoutId === 'string'
        ? new mongoose.Types.ObjectId(params.supplierPayoutId)
        : params.supplierPayoutId;
    const storeId =
      typeof params.storeId === 'string' ? new mongoose.Types.ObjectId(params.storeId) : params.storeId;

    return await withTransaction(async (session) => {
      // Get supplier payout
      const payout = await SupplierPayout.findById(supplierPayoutId).session(session);
      if (!payout) {
        return { success: false, error: 'Supplier payout not found' };
      }

      if (payout.payoutStatus !== 'pending') {
        return { success: false, error: `Payout already ${payout.payoutStatus}` };
      }

      // Get supplier PayPal email (should be stored in supplier profile or payout metadata)
      const paypalEmail = (payout as any).metadata?.paypalEmail;
      if (!paypalEmail) {
        return { success: false, error: 'PayPal email not configured for supplier' };
      }

      // Create PayPal payout batch
      // Note: PayPal SDK structure may vary - adjust based on actual SDK version
      // The PayPal SDK may not have payouts in the checkout-server-sdk
      // This is a placeholder - adjust based on your actual PayPal SDK version
      const PayoutsPostRequest = (paypal as any).payouts?.PayoutsPostRequest;
      if (!PayoutsPostRequest) {
        return { success: false, error: 'PayPal payout SDK not available. Please use PayPal Payouts SDK separately.' };
      }
      const request = new PayoutsPostRequest();
      request.requestBody({
        sender_batch_header: {
          sender_batch_id: `payout_${payout._id.toString()}_${Date.now()}`,
          email_subject: `Payout for order ${payout.orderId}`,
          email_message: `You have received a payout of ${payout.payoutAmount} ${(payout as any).currency || 'USD'} for order ${payout.orderId}.`,
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: {
              value: payout.payoutAmount.toFixed(2),
              currency: (payout as any).currency || 'USD',
            },
            receiver: paypalEmail,
            note: `Payout for order ${payout.orderId}`,
            sender_item_id: payout._id.toString(),
          },
        ],
      });

      const response = await paypalClient.execute(request);
      const payoutBatch = response.result;

      if (!payoutBatch || !payoutBatch.batch_header) {
        return { success: false, error: 'Failed to create PayPal payout' };
      }

      // Create payout record
      const payoutRecord = new PayPalPayout({
        storeId,
        supplierId: payout.supplierId,
        supplierPayoutId: payout._id,
        orderId: payout.orderId,
        paypalBatchId: payoutBatch.batch_header.payout_batch_id,
        amount: Math.round(payout.payoutAmount * 100), // Convert to cents
        currency: (payout as any).currency || 'USD',
        status: payoutBatch.batch_header.batch_status === 'SUCCESS' ? 'paid' : 'pending',
        metadata: {
          batchStatus: payoutBatch.batch_header.batch_status,
          paypalEmail,
        },
      });

      await payoutRecord.save({ session });

      // Update payout status
      payout.payoutStatus = payoutBatch.batch_header.batch_status === 'SUCCESS' ? 'processed' : 'pending';
      payout.payoutDate = new Date();
      await payout.save({ session });

      // Audit log
      await logAudit({
        storeId: storeId.toString(),
        actorRole: 'system',
        action: 'PAYPAL_PAYOUT_PROCESSED',
        entityType: 'SupplierPayout',
        entityId: payout._id.toString(),
        description: `Payout processed via PayPal: ${payoutBatch.batch_header.payout_batch_id}`,
        after: {
          payoutStatus: payout.payoutStatus,
          payoutBatchId: payoutBatch.batch_header.payout_batch_id,
          amount: payout.payoutAmount,
        },
        metadata: {
          orderId: payout.orderId,
          paypalBatchId: payoutBatch.batch_header.payout_batch_id,
        },
      });

      return {
        success: true,
        payoutId: payoutBatch.batch_header.payout_batch_id,
      };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to process payout',
    };
  }
}

/**
 * Process all pending payouts for a supplier
 */
export async function processAllSupplierPayouts(
  supplierId: mongoose.Types.ObjectId | string,
  storeId: mongoose.Types.ObjectId | string
): Promise<{ processed: number; failed: number; errors: string[] }> {
  const supplierObjId =
    typeof supplierId === 'string' ? new mongoose.Types.ObjectId(supplierId) : supplierId;
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const payouts = await SupplierPayout.find({
    supplierId: supplierObjId,
    storeId: storeObjId,
    payoutStatus: 'pending',
  });

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const payout of payouts) {
    const result = await processSupplierPayout({
      supplierPayoutId: payout._id,
      storeId: storeObjId,
    });

    if (result.success) {
      processed++;
    } else {
      failed++;
      errors.push(`Payout ${payout._id}: ${result.error}`);
    }
  }

  return { processed, failed, errors };
}

