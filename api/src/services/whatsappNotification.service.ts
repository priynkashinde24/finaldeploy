import mongoose from 'mongoose';
import { WhatsAppNotificationLog } from '../models/WhatsAppNotificationLog';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Order } from '../models/Order';
import { whatsappProvider } from './whatsappProvider';
import { getWhatsAppTemplate, OrderLifecycleEvent, WhatsAppAudience } from '../constants/whatsappTemplates';
import { buildTemplateVariables } from '../utils/whatsappVariableBuilder';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';

/**
 * WhatsApp Notification Service
 *
 * PURPOSE:
 * - Send WhatsApp notifications for order lifecycle events
 * - Ensure idempotency
 * - Handle failures gracefully
 * - Respect opt-in and quiet hours
 *
 * RULES:
 * - Only send if whatsappOptIn = true
 * - One notification per event per order per role
 * - Never block order flow
 */

export interface SendOrderNotificationParams {
  orderId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
  eventType: OrderLifecycleEvent;
  role: WhatsAppAudience;
  userId?: mongoose.Types.ObjectId | string; // Optional: specific user to notify
}

export interface SendOrderNotificationResult {
  success: boolean;
  notificationLogId?: string;
  error?: string;
}

const QUIET_HOURS_START = 22; // 10 PM
const QUIET_HOURS_END = 8; // 8 AM
const MAX_RETRIES = 3;

/**
 * Get store WhatsApp notification configuration
 */
async function getStoreWhatsAppConfig(
  storeId: mongoose.Types.ObjectId | string
): Promise<{
  enabled: boolean;
  customerEnabled: boolean;
  supplierEnabled: boolean;
  resellerEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  enabledEvents: string[];
}> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const store = await Store.findById(storeObjId).select('metadata').lean();
  const config = (store as any)?.metadata?.whatsappNotifications || {};

  return {
    enabled: config.enabled !== false,
    customerEnabled: config.customerEnabled !== false,
    supplierEnabled: config.supplierEnabled !== false,
    resellerEnabled: config.resellerEnabled !== false,
    quietHoursEnabled: config.quietHoursEnabled !== false,
    quietHoursStart: config.quietHoursStart || QUIET_HOURS_START,
    quietHoursEnd: config.quietHoursEnd || QUIET_HOURS_END,
    enabledEvents: config.enabledEvents || [], // Empty array = all events enabled
  };
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(quietHoursStart: number, quietHoursEnd: number): boolean {
  const now = new Date();
  const currentHour = now.getHours();

  if (quietHoursStart > quietHoursEnd) {
    // Quiet hours span midnight (e.g., 22:00 - 08:00)
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
  } else {
    // Quiet hours within same day (e.g., 22:00 - 08:00 next day)
    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
  }
}

/**
 * Resolve recipient phone number and verify opt-in
 */
async function resolveRecipient(
  order: any,
  role: WhatsAppAudience,
  userId?: mongoose.Types.ObjectId | string
): Promise<{ phoneNumber: string; user: any } | null> {
  let targetUser: any = null;

  if (role === 'customer') {
    if (order.customerId) {
      const customerObjId = typeof order.customerId === 'string' ? new mongoose.Types.ObjectId(order.customerId) : order.customerId;
      targetUser = await User.findById(customerObjId).select('phoneNumber whatsappOptIn name').lean();
    } else if (order.customerEmail) {
      // Try to find user by email
      targetUser = await User.findOne({ email: order.customerEmail }).select('phoneNumber whatsappOptIn name').lean();
    }
  } else if (role === 'supplier') {
    if (order.supplierId) {
      const supplierObjId = typeof order.supplierId === 'string' ? new mongoose.Types.ObjectId(order.supplierId) : order.supplierId;
      targetUser = await User.findById(supplierObjId).select('phoneNumber whatsappOptIn name').lean();
    } else if (userId) {
      const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      targetUser = await User.findById(userObjId).select('phoneNumber whatsappOptIn name').lean();
    }
  } else if (role === 'reseller') {
    // Reseller is the store owner
    const store = await Store.findById(order.storeId).select('ownerId').lean();
    if (store?.ownerId) {
      const ownerObjId = typeof store.ownerId === 'string' ? new mongoose.Types.ObjectId(store.ownerId) : store.ownerId;
      targetUser = await User.findById(ownerObjId).select('phoneNumber whatsappOptIn name').lean();
    }
  }

  if (!targetUser || !targetUser.phoneNumber) {
    return null; // No phone number available
  }

  if (!targetUser.whatsappOptIn) {
    return null; // User has not opted in
  }

  return {
    phoneNumber: targetUser.phoneNumber,
    user: targetUser,
  };
}

/**
 * Send WhatsApp notification for order event
 */
export async function sendOrderNotification(
  params: SendOrderNotificationParams
): Promise<SendOrderNotificationResult> {
  const { orderId, storeId, eventType, role, userId } = params;

  try {
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;

    // STEP 1: Get store configuration
    const config = await getStoreWhatsAppConfig(storeObjId);
    if (!config.enabled) {
      return { success: false, error: 'WhatsApp notifications are disabled for this store' };
    }

    // Check role-specific enablement
    if (role === 'customer' && !config.customerEnabled) {
      return { success: false, error: 'Customer WhatsApp notifications are disabled' };
    }
    if (role === 'supplier' && !config.supplierEnabled) {
      return { success: false, error: 'Supplier WhatsApp notifications are disabled' };
    }
    if (role === 'reseller' && !config.resellerEnabled) {
      return { success: false, error: 'Reseller WhatsApp notifications are disabled' };
    }

    // Check if event is enabled
    if (config.enabledEvents.length > 0 && !config.enabledEvents.includes(eventType)) {
      return { success: false, error: `Event ${eventType} is disabled for this store` };
    }

    // STEP 2: Check for existing notification (idempotency)
    const existingLog = await WhatsAppNotificationLog.findOne({
      orderId: orderObjId,
      eventType,
      role,
      status: { $in: ['queued', 'sent', 'delivered'] },
    }).lean();

    if (existingLog) {
      return {
        success: true,
        notificationLogId: existingLog._id.toString(),
        error: 'Notification already sent (idempotency)',
      };
    }

    // STEP 3: Get order
    const order = await Order.findById(orderObjId).lean();
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // STEP 4: Resolve template
    const template = getWhatsAppTemplate(eventType, role);
    if (!template) {
      return { success: false, error: `No template found for event ${eventType} and role ${role}` };
    }

    // STEP 5: Resolve recipient
    const recipient = await resolveRecipient(order, role, userId);
    if (!recipient) {
      return { success: false, error: 'No recipient found or user has not opted in' };
    }

    // STEP 6: Check quiet hours
    if (config.quietHoursEnabled && isQuietHours(config.quietHoursStart, config.quietHoursEnd)) {
      // Queue for later (outside quiet hours)
      const notificationLog = new WhatsAppNotificationLog({
        storeId: storeObjId,
        orderId: orderObjId,
        userId: recipient.user._id,
        role,
        phoneNumber: recipient.phoneNumber,
        eventType,
        templateName: template.templateName,
        status: 'queued',
        templateVariables: {},
        metadata: {
          queuedForQuietHours: true,
          quietHoursStart: config.quietHoursStart,
          quietHoursEnd: config.quietHoursEnd,
        },
      });
      await notificationLog.save();

      return {
        success: true,
        notificationLogId: notificationLog._id.toString(),
        error: 'Notification queued for quiet hours',
      };
    }

    // STEP 7: Build template variables
    const store = await Store.findById(storeObjId).select('name').lean();
    const templateVariables = await buildTemplateVariables(order, role, store, recipient.user);

    // STEP 8: Send via WhatsApp provider
    const sendResult = await whatsappProvider.sendTemplateMessage({
      to: recipient.phoneNumber,
      templateName: template.templateName,
      language: 'en',
      variables: templateVariables,
    });

    // STEP 9: Save log entry
    const notificationLog = new WhatsAppNotificationLog({
      storeId: storeObjId,
      orderId: orderObjId,
      userId: recipient.user._id,
      role,
      phoneNumber: recipient.phoneNumber,
      eventType,
      templateName: template.templateName,
      status: sendResult.success ? 'sent' : 'failed',
      providerMessageId: sendResult.providerMessageId,
      sentAt: sendResult.success ? new Date() : undefined,
      failedAt: !sendResult.success ? new Date() : undefined,
      failureReason: !sendResult.success ? sendResult.error : undefined,
      retryCount: 0,
      templateVariables,
    });
    await notificationLog.save();

    // STEP 10: Audit log
    await logAudit({
      storeId: storeObjId.toString(),
      actorRole: 'system',
      action: sendResult.success ? 'WHATSAPP_ORDER_NOTIFICATION_SENT' : 'WHATSAPP_ORDER_NOTIFICATION_FAILED',
      entityType: 'WhatsAppNotificationLog',
      entityId: notificationLog._id.toString(),
      description: `WhatsApp notification ${sendResult.success ? 'sent' : 'failed'}: ${eventType} for order ${order.orderNumber || order.orderId}`,
      metadata: {
        orderId: orderObjId.toString(),
        eventType,
        role,
        templateName: template.templateName,
        phoneNumber: recipient.phoneNumber,
        success: sendResult.success,
        error: sendResult.error,
      },
    });

    // STEP 11: Emit event
    if (sendResult.success) {
      eventStreamEmitter.emit('event', {
        eventType: 'WHATSAPP_ORDER_NOTIFICATION_SENT',
        payload: {
          orderId: orderObjId.toString(),
          eventType,
          role,
          templateName: template.templateName,
          notificationLogId: notificationLog._id.toString(),
        },
        storeId: storeObjId.toString(),
        userId: recipient.user._id?.toString(),
        occurredAt: new Date(),
      });
    }

    return {
      success: sendResult.success,
      notificationLogId: notificationLog._id.toString(),
      error: sendResult.error,
    };
  } catch (error: any) {
    console.error('[WHATSAPP NOTIFICATION] Error sending notification:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

