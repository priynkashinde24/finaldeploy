import { eventStreamEmitter } from '../controllers/eventController';
import { Order } from '../models/Order';
import { UserReferral } from '../models/UserReferral';
import { ReferralReward } from '../models/ReferralReward';
import { calculateReferralReward } from '../utils/referralRewardEngine';
import { PayoutLedger } from '../models/PayoutLedger';
import { logAudit } from '../utils/auditLogger';
import mongoose from 'mongoose';

/**
 * Referral Reward Listener
 *
 * PURPOSE:
 * - Listen for ORDER_CREATED events
 * - Calculate and credit referral rewards
 * - Create ledger entries
 * - Update reward status
 */

export function initializeReferralRewardListeners(): void {
  eventStreamEmitter.on('event', async (event: any) => {
    if (event.eventType === 'ORDER_CREATED') {
      try {
        const { orderId, storeId } = event.payload;

        if (!orderId || !storeId) {
          console.warn('[REFERRAL REWARD LISTENER] Missing orderId or storeId in ORDER_CREATED event');
          return;
        }

        // Find order
        const order = await Order.findOne({ orderId }).lean();
        if (!order || !order.referralSnapshot) {
          return; // No referral attribution
        }

        const storeObjId = new mongoose.Types.ObjectId(storeId);
        const orderObjId = typeof order._id === 'string' ? new mongoose.Types.ObjectId(order._id) : order._id;

        // Find user referral
        const userReferral = await UserReferral.findOne({
          userId: order.customerId,
          referralCode: order.referralSnapshot.referralCode,
        }).lean();

        if (!userReferral) {
          console.warn(`[REFERRAL REWARD LISTENER] UserReferral not found for order ${orderId}`);
          return;
        }

        // Calculate reward
        const rewardCalculation = await calculateReferralReward({
          storeId: storeObjId,
          order: order as any,
          userReferral: userReferral as any,
        });

        if (!rewardCalculation || rewardCalculation.reward === 0) {
          console.log(
            `[REFERRAL REWARD LISTENER] No reward for order ${orderId}: ${rewardCalculation?.reason || 'No rule matched'}`
          );
          return;
        }

        // Check if reward already exists (prevent duplicates)
        const existingReward = await ReferralReward.findOne({
          orderId: orderObjId,
          referrerId: userReferral.referrerId,
        }).lean();

        if (existingReward) {
          console.log(`[REFERRAL REWARD LISTENER] Reward already exists for order ${orderId}`);
          return;
        }

        // Create referral reward
        const referralReward = new ReferralReward({
          storeId: storeObjId,
          referrerId: userReferral.referrerId,
          referrerType: userReferral.referrerType,
          referredUserId: userReferral.userId,
          orderId: orderObjId,
          referralCode: userReferral.referralCode,
          amount: rewardCalculation.reward,
          status: 'pending',
          rewardRuleId: rewardCalculation.rule._id,
          rewardSnapshot: rewardCalculation.rewardSnapshot,
        });

        await referralReward.save();

        // Create ledger entry
        const ledgerEntry = new PayoutLedger({
          storeId: storeObjId,
          entityType: userReferral.referrerType === 'reseller' ? 'reseller' : 'supplier', // Map referrerType to entityType
          entityId: userReferral.referrerId.toString(),
          orderId: order.orderId,
          amount: rewardCalculation.reward,
          status: 'pending',
          availableAt: new Date(), // Referral rewards available immediately
          metadata: {
            type: 'referral_reward',
            referralRewardId: referralReward._id.toString(),
            referralCode: userReferral.referralCode,
          },
        });

        await ledgerEntry.save();

        // Link ledger entry to reward
        referralReward.ledgerEntryId = ledgerEntry._id;
        referralReward.status = 'paid'; // Mark as paid (ledger entry created)
        referralReward.paidAt = new Date();
        await referralReward.save();

        // Audit log
        await logAudit({
          storeId: storeId.toString(),
          actorRole: 'system',
          action: 'REFERRAL_REWARD_CREDITED',
          entityType: 'ReferralReward',
          entityId: referralReward._id.toString(),
          description: `Referral reward credited: ${rewardCalculation.reward} for order ${order.orderNumber}`,
          metadata: {
            referralCode: userReferral.referralCode,
            referrerId: userReferral.referrerId.toString(),
            referrerType: userReferral.referrerType,
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            amount: rewardCalculation.reward,
            rewardRuleId: rewardCalculation.rule._id.toString(),
          },
        });

        // Emit event
        eventStreamEmitter.emit('event', {
          eventType: 'REFERRAL_REWARD_CREDITED',
          payload: {
            referralRewardId: referralReward._id.toString(),
            referrerId: userReferral.referrerId.toString(),
            orderId: order.orderId,
            amount: rewardCalculation.reward,
          },
          storeId: storeId.toString(),
          occurredAt: new Date(),
        });

        console.log(
          `[REFERRAL REWARD LISTENER] Reward credited: ${rewardCalculation.reward} for order ${order.orderNumber}`
        );
      } catch (error: any) {
        console.error('[REFERRAL REWARD LISTENER] Error processing referral reward:', error);
      }
    }
  });

  console.log('[REFERRAL REWARD LISTENER] Initialized');
}

