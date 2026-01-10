import mongoose from 'mongoose';
import { WhatsAppMessageLog } from '../models/WhatsAppMessageLog';
import { WhatsAppRecoveryMetrics } from '../models/WhatsAppRecoveryMetrics';
import { Cart } from '../models/Cart';
import { CartRecoveryToken } from '../models/CartRecoveryToken';
import { whatsappProvider } from '../services/whatsappProvider';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';

/**
 * WhatsApp Recovery Sender Job
 *
 * PURPOSE:
 * - Send queued WhatsApp recovery messages
 * - Update delivery status
 * - Handle retries with exponential backoff
 * - Track provider message IDs
 *
 * RUNS:
 * - Every minute (configurable)
 */

export interface WhatsAppRecoverySenderOptions {
  storeId?: mongoose.Types.ObjectId | string;
  batchSize?: number; // Default: 50
  maxRetries?: number; // Default: 3
}

export interface WhatsAppRecoverySenderResult {
  sentCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
}

/**
 * Default retry delays (exponential backoff in minutes)
 */
const RETRY_DELAYS = [5, 15, 60]; // 5 min, 15 min, 1 hour

/**
 * Send queued WhatsApp recovery messages
 */
export async function sendQueuedWhatsAppMessages(
  options: WhatsAppRecoverySenderOptions = {}
): Promise<WhatsAppRecoverySenderResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: string[] = [];
  let sentCount = 0;
  let failedCount = 0;

  const batchSize = options.batchSize || 50;
  const maxRetries = options.maxRetries || 3;
  const storeObjId = options.storeId
    ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
    : null;

  try {
    // Find queued messages that are due
    const filter: any = {
      status: 'queued',
      scheduledFor: { $lte: now },
    };

    if (storeObjId) {
      filter.storeId = storeObjId;
    }

    const queuedMessages = await WhatsAppMessageLog.find(filter)
      .limit(batchSize)
      .sort({ scheduledFor: 1 })
      .lean();

    console.log(
      `[WHATSAPP RECOVERY SENDER] Found ${queuedMessages.length} queued messages to send`
    );

    // Process each message
    for (const messageLog of queuedMessages) {
      try {
        const messageDoc = await WhatsAppMessageLog.findById(messageLog._id);
        if (!messageDoc || messageDoc.status !== 'queued') {
          continue; // Already processed
        }

        // STEP 1: Re-check cart status
        const cart = await Cart.findById(messageDoc.cartId);
        if (!cart || cart.status !== 'abandoned') {
          // Cart converted or deleted, cancel message
          messageDoc.status = 'cancelled';
          await messageDoc.save();
          continue;
        }

        // STEP 2: Get recovery token
        const recoveryToken = await CartRecoveryToken.findById(messageDoc.recoveryTokenId);
        if (!recoveryToken || recoveryToken.usedAt || recoveryToken.expiresAt < now) {
          // Token used or expired, cancel message
          messageDoc.status = 'cancelled';
          await messageDoc.save();
          continue;
        }

        // STEP 3: Build template variables
        const storeName = messageDoc.metadata?.storeName || 'Our Store';
        const itemCount = messageDoc.metadata?.itemCount || cart.items.length;
        const recoveryUrl = messageDoc.metadata?.recoveryUrl || '';

        const templateVariables: Record<string, string> = {
          name: 'Customer', // TODO: Get from user profile
          itemCount: itemCount.toString(),
          storeName: storeName,
          recoveryLink: recoveryUrl,
        };

        // STEP 4: Send via WhatsApp provider
        const sendResult = await whatsappProvider.sendTemplateMessage({
          to: messageDoc.phoneNumber,
          templateName: messageDoc.templateName,
          language: 'en',
          variables: templateVariables,
        });

        if (sendResult.success && sendResult.providerMessageId) {
          // Success
          messageDoc.status = 'sent';
          messageDoc.providerMessageId = sendResult.providerMessageId;
          messageDoc.sentAt = new Date();
          messageDoc.retryCount = 0;
          await messageDoc.save();

          sentCount++;

          // Create metrics record
          const metrics = new WhatsAppRecoveryMetrics({
            storeId: messageDoc.storeId,
            cartId: messageDoc.cartId,
            messageLogId: messageDoc._id,
            phoneNumber: messageDoc.phoneNumber,
            messageType: messageDoc.messageType,
            sentAt: new Date(),
          });
          await metrics.save();

          // Emit event
          eventStreamEmitter.emit('event', {
            eventType: 'WHATSAPP_MESSAGE_SENT',
            payload: {
              cartId: messageDoc.cartId.toString(),
              messageType: messageDoc.messageType,
              providerMessageId: sendResult.providerMessageId,
            },
            storeId: messageDoc.storeId.toString(),
            userId: messageDoc.userId?.toString(),
            occurredAt: new Date(),
          });

          // Audit log
          await logAudit({
            storeId: messageDoc.storeId.toString(),
            actorRole: 'system',
            action: 'WHATSAPP_MESSAGE_SENT',
            entityType: 'WhatsAppMessageLog',
            entityId: messageDoc._id.toString(),
            description: `WhatsApp recovery message sent: ${messageDoc.messageType}`,
            metadata: {
              cartId: messageDoc.cartId.toString(),
              phoneNumber: messageDoc.phoneNumber,
              messageType: messageDoc.messageType,
              providerMessageId: sendResult.providerMessageId,
            },
          });
        } else {
          // Failed - retry if under max retries
          if (messageDoc.retryCount < maxRetries) {
            const retryDelay = RETRY_DELAYS[messageDoc.retryCount] || 60; // Default to 60 min
            const retryTime = new Date(now.getTime() + retryDelay * 60 * 1000);

            messageDoc.retryCount += 1;
            messageDoc.scheduledFor = retryTime;
            messageDoc.errorMessage = sendResult.error || 'Unknown error';
            await messageDoc.save();

            console.log(
              `[WHATSAPP RECOVERY SENDER] Message ${messageDoc._id} failed, retry ${messageDoc.retryCount}/${maxRetries} scheduled for ${retryTime}`
            );
          } else {
            // Max retries reached, mark as failed
            messageDoc.status = 'failed';
            messageDoc.errorMessage = sendResult.error || 'Max retries reached';
            await messageDoc.save();

            failedCount++;
            errors.push(`Message ${messageDoc._id}: ${sendResult.error || 'Max retries reached'}`);
          }
        }
      } catch (error: any) {
        console.error(`[WHATSAPP RECOVERY SENDER] Error processing message ${messageLog._id}:`, error);
        errors.push(`Failed to process message ${messageLog._id}: ${error.message}`);

        // Mark as failed after max retries
        const messageDoc = await WhatsAppMessageLog.findById(messageLog._id);
        if (messageDoc && messageDoc.retryCount >= (options.maxRetries || 3)) {
          messageDoc.status = 'failed';
          messageDoc.errorMessage = error.message;
          await messageDoc.save();
          failedCount++;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[WHATSAPP RECOVERY SENDER] Completed: Sent ${sentCount}, Failed ${failedCount}, ` +
      `Errors: ${errors.length}, Duration: ${duration}ms`
    );

    return {
      sentCount,
      failedCount,
      errors,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[WHATSAPP RECOVERY SENDER] Global error:', error);
    errors.push(`Global send error: ${error.message}`);
    return {
      sentCount: 0,
      failedCount: 0,
      errors,
      duration,
    };
  }
}

/**
 * Run sender for all stores (for global cron)
 */
export async function runGlobalWhatsAppRecoverySender(): Promise<WhatsAppRecoverySenderResult> {
  return sendQueuedWhatsAppMessages({
    batchSize: 50,
  });
}

