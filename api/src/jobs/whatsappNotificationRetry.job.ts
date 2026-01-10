import mongoose from 'mongoose';
import { WhatsAppNotificationLog } from '../models/WhatsAppNotificationLog';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { whatsappProvider } from '../services/whatsappProvider';
import { getWhatsAppTemplate } from '../constants/whatsappTemplates';
import { buildTemplateVariables } from '../utils/whatsappVariableBuilder';
import { logAudit } from '../utils/auditLogger';

/**
 * WhatsApp Notification Retry Job
 *
 * PURPOSE:
 * - Retry failed WhatsApp order notifications
 * - Handle transient failures
 * - Respect max retries
 *
 * RUNS:
 * - Every 5 minutes (configurable)
 */

export interface WhatsAppNotificationRetryOptions {
  storeId?: mongoose.Types.ObjectId | string;
  batchSize?: number; // Default: 20
  maxRetries?: number; // Default: 3
}

export interface WhatsAppNotificationRetryResult {
  retriedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
}

const RETRY_DELAYS = [5, 30, 120]; // 5 min, 30 min, 2 hours (in minutes)

/**
 * Retry failed WhatsApp notifications
 */
export async function retryFailedWhatsAppNotifications(
  options: WhatsAppNotificationRetryOptions = {}
): Promise<WhatsAppNotificationRetryResult> {
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
      status: 'failed',
      retryCount: { $lt: maxRetries },
      failedAt: {
        $lte: new Date(Date.now() - RETRY_DELAYS[0] * 60 * 1000), // Wait at least 5 min before retry
      },
    };

    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    const failedNotifications = await WhatsAppNotificationLog.find(filter)
      .sort({ failedAt: 1 })
      .limit(batchSize)
      .lean();

    console.log(
      `[WHATSAPP NOTIFICATION RETRY] Found ${failedNotifications.length} failed notifications to retry`
    );

    for (const notification of failedNotifications) {
      try {
        const notificationDoc = await WhatsAppNotificationLog.findById(notification._id);
        if (!notificationDoc || notificationDoc.status !== 'failed') {
          continue; // Already processed
        }

        // Re-check if user has opted out
        if (notificationDoc.userId) {
          const user = await User.findById(notificationDoc.userId).select('whatsappOptIn').lean();
          if (!user || !user.whatsappOptIn) {
            notificationDoc.status = 'cancelled';
            await notificationDoc.save();
            continue;
          }
        }

        // Get order
        const order = await Order.findById(notificationDoc.orderId).lean();
        if (!order) {
          notificationDoc.status = 'cancelled';
          await notificationDoc.save();
          continue;
        }

        // Get template
        const template = getWhatsAppTemplate(
          notificationDoc.eventType as any,
          notificationDoc.role
        );
        if (!template) {
          notificationDoc.status = 'cancelled';
          await notificationDoc.save();
          continue;
        }

        // Build variables
        const store = await Store.findById(notificationDoc.storeId).select('name').lean();
        const user = notificationDoc.userId
          ? await User.findById(notificationDoc.userId).select('name').lean()
          : null;

        const templateVariables = await buildTemplateVariables(
          order as any,
          notificationDoc.role,
          store,
          user
        );

        // Retry send
        const sendResult = await whatsappProvider.sendTemplateMessage({
          to: notificationDoc.phoneNumber,
          templateName: template.templateName,
          language: 'en',
          variables: templateVariables,
        });

        if (sendResult.success) {
          notificationDoc.status = 'sent';
          notificationDoc.sentAt = new Date();
          notificationDoc.providerMessageId = sendResult.providerMessageId;
          notificationDoc.retryCount = (notificationDoc.retryCount || 0) + 1;
          notificationDoc.templateVariables = templateVariables;
          await notificationDoc.save();

          retriedCount++;

          await logAudit({
            storeId: notificationDoc.storeId.toString(),
            actorRole: 'system',
            action: 'WHATSAPP_ORDER_NOTIFICATION_RETRIED',
            entityType: 'WhatsAppNotificationLog',
            entityId: notificationDoc._id.toString(),
            description: `WhatsApp order notification retried successfully: ${notificationDoc.eventType}`,
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

          if (notificationDoc.retryCount >= maxRetries) {
            notificationDoc.status = 'failed'; // Permanent failure
            failedCount++;
            errors.push(
              `Notification ${notificationDoc._id}: Max retries reached (${notificationDoc.retryCount})`
            );
          }

          await notificationDoc.save();
        }
      } catch (error: any) {
        console.error(
          `[WHATSAPP NOTIFICATION RETRY] Error retrying notification ${notification._id}:`,
          error
        );
        errors.push(`Error retrying notification ${notification._id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[WHATSAPP NOTIFICATION RETRY] Completed: Retried ${retriedCount}, Failed ${failedCount}, ` +
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
    console.error('[WHATSAPP NOTIFICATION RETRY] Global error:', error);
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
export async function runGlobalWhatsAppNotificationRetry(): Promise<WhatsAppNotificationRetryResult> {
  return retryFailedWhatsAppNotifications({
    batchSize: 20,
  });
}

