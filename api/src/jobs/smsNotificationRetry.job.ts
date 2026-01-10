import mongoose from 'mongoose';
import { SMSNotificationLog } from '../models/SMSNotificationLog';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { smsProvider } from '../services/smsProvider';
import { logAudit } from '../utils/auditLogger';

/**
 * SMS Notification Retry Job
 *
 * PURPOSE:
 * - Retry failed SMS order notifications
 * - Handle transient failures
 * - Respect max retries
 *
 * RUNS:
 * - Every 5 minutes (configurable)
 */

export interface SMSNotificationRetryOptions {
  storeId?: mongoose.Types.ObjectId | string;
  batchSize?: number; // Default: 20
  maxRetries?: number; // Default: 3
}

export interface SMSNotificationRetryResult {
  retriedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
}

const RETRY_DELAYS = [5, 30, 120]; // 5 min, 30 min, 2 hours (in minutes)

/**
 * Check if error is transient (retryable)
 */
function isTransientError(error: string): boolean {
  const transientPatterns = [
    'timeout',
    'network',
    'connection',
    'temporary',
    'rate limit',
    'throttle',
    'service unavailable',
    '503',
    '502',
    '504',
  ];

  const errorLower = error.toLowerCase();
  return transientPatterns.some((pattern) => errorLower.includes(pattern));
}

/**
 * Retry failed SMS notifications
 */
export async function retryFailedSMSNotifications(
  options: SMSNotificationRetryOptions = {}
): Promise<SMSNotificationRetryResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let retriedCount = 0;
  let failedCount = 0;

  const batchSize = options.batchSize || 20;
  const maxRetries = options.maxRetries || 3;
  const storeObjId = options.storeId
    ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
    : null;

  try {
    const filter: any = {
      status: { $in: ['failed', 'queued'] },
      retryCount: { $lt: maxRetries },
      $or: [
        {
          failedAt: {
            $lte: new Date(Date.now() - RETRY_DELAYS[0] * 60 * 1000), // Wait at least 5 min before retry
          },
        },
        {
          // For queued messages (quiet hours), retry if outside quiet hours
          'metadata.queuedForQuietHours': true,
        },
      ],
    };

    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    const failedNotifications = await SMSNotificationLog.find(filter)
      .sort({ failedAt: 1, createdAt: 1 })
      .limit(batchSize)
      .lean();

    console.log(
      `[SMS NOTIFICATION RETRY] Found ${failedNotifications.length} failed/queued notifications to retry`
    );

    for (const notification of failedNotifications) {
      try {
        const notificationDoc = await SMSNotificationLog.findById(notification._id);
        if (!notificationDoc || (notificationDoc.status !== 'failed' && notificationDoc.status !== 'queued')) {
          continue; // Already processed
        }

        // Re-check if user has opted out
        if (notificationDoc.userId) {
          const user = await User.findById(notificationDoc.userId).select('smsOptIn').lean();
          if (!user || !user.smsOptIn) {
            notificationDoc.status = 'cancelled';
            await notificationDoc.save();
            continue;
          }
        }

        // Check if this is a queued message (quiet hours)
        const isQueuedForQuietHours = notificationDoc.metadata?.queuedForQuietHours === true;
        if (isQueuedForQuietHours) {
          // Check if we're outside quiet hours now
          const store = await Store.findById(notificationDoc.storeId).select('metadata').lean();
          const smsConfig = (store as any)?.metadata?.smsNotifications || {};
          const quietHoursStart = smsConfig.quietHoursStart || 22;
          const quietHoursEnd = smsConfig.quietHoursEnd || 8;

          const now = new Date();
          const currentHour = now.getHours();
          let isQuietHours = false;

          if (quietHoursStart > quietHoursEnd) {
            isQuietHours = currentHour >= quietHoursStart || currentHour < quietHoursEnd;
          } else {
            isQuietHours = currentHour >= quietHoursStart && currentHour < quietHoursEnd;
          }

          if (isQuietHours) {
            continue; // Still in quiet hours, skip
          }
        }

        // Get order (for context, but message is already rendered)
        const order = await Order.findById(notificationDoc.orderId).lean();
        if (!order) {
          notificationDoc.status = 'cancelled';
          await notificationDoc.save();
          continue;
        }

        // Retry send (use existing message or rebuild if needed)
        let message = notificationDoc.message;
        if (!message || message.trim() === '') {
          // Rebuild message if not stored
          // This shouldn't happen, but handle gracefully
          console.warn(`[SMS NOTIFICATION RETRY] Message missing for notification ${notificationDoc._id}, skipping`);
          continue;
        }

        const sendResult = await smsProvider.sendSMS({
          to: notificationDoc.phoneNumber,
          message,
        });

        if (sendResult.success) {
          notificationDoc.status = 'sent';
          notificationDoc.sentAt = new Date();
          notificationDoc.providerMessageId = sendResult.providerMessageId;
          notificationDoc.retryCount = (notificationDoc.retryCount || 0) + 1;
          if (notificationDoc.metadata) {
            notificationDoc.metadata.queuedForQuietHours = false;
          }
          await notificationDoc.save();

          retriedCount++;

          await logAudit({
            storeId: notificationDoc.storeId.toString(),
            actorRole: 'system',
            action: 'SMS_NOTIFICATION_RETRIED',
            entityType: 'SMSNotificationLog',
            entityId: notificationDoc._id.toString(),
            description: `SMS order notification retried successfully: ${notificationDoc.eventType}`,
            metadata: {
              orderId: notificationDoc.orderId.toString(),
              eventType: notificationDoc.eventType,
              role: notificationDoc.role,
              retryCount: notificationDoc.retryCount,
            },
          });
        } else {
          notificationDoc.retryCount = (notificationDoc.retryCount || 0) + 1;
          notificationDoc.failureReason = sendResult.error || 'Retry failed';
          notificationDoc.failedAt = new Date();

          // Check if error is permanent (don't retry)
          const isPermanent = !isTransientError(sendResult.error || '');
          if (isPermanent || notificationDoc.retryCount >= maxRetries) {
            notificationDoc.status = 'failed'; // Permanent failure
            failedCount++;
            errors.push(
              `Notification ${notificationDoc._id}: ${isPermanent ? 'Permanent error' : 'Max retries reached'} (${notificationDoc.retryCount})`
            );
          }

          await notificationDoc.save();
        }
      } catch (error: any) {
        console.error(
          `[SMS NOTIFICATION RETRY] Error retrying notification ${notification._id}:`,
          error
        );
        errors.push(`Error retrying notification ${notification._id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[SMS NOTIFICATION RETRY] Completed: Retried ${retriedCount}, Failed ${failedCount}, ` +
      `Errors: ${errors.length}, Duration: ${duration}ms`
    );

    return {
      retriedCount,
      failedCount,
      errors,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[SMS NOTIFICATION RETRY] Global error:', error);
    errors.push(`Global retry error: ${error.message}`);
    return {
      retriedCount: 0,
      failedCount: 0,
      errors,
      duration,
    };
  }
}

/**
 * Run retry for all stores (for global cron)
 */
export async function runGlobalSMSNotificationRetry(): Promise<SMSNotificationRetryResult> {
  return retryFailedSMSNotifications({
    batchSize: 20,
  });
}

