import mongoose from 'mongoose';
import { SMSNotificationLog } from '../models/SMSNotificationLog';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Order } from '../models/Order';
import { smsProvider } from './smsProvider';
import { getSMSTemplate, OrderLifecycleEvent, SMSAudience, renderSMSTemplate } from '../constants/smsTemplates';
import { buildTemplateVariables } from '../utils/smsVariableBuilder';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';

/**
 * SMS Notification Service
 *
 * PURPOSE:
 * - Send SMS notifications for order lifecycle events
 * - Ensure idempotency
 * - Handle failures gracefully
 * - Respect opt-in and quiet hours
 * - Work as fallback to WhatsApp
 *
 * RULES:
 * - Only send if smsOptIn = true
 * - One notification per event per order per role
 * - Never block order flow
 * - Max 1 SMS per event per order (rate limiting)
 */

export interface SendOrderSMSParams {
  orderId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
  eventType: OrderLifecycleEvent;
  role: SMSAudience;
  userId?: mongoose.Types.ObjectId | string; // Optional: specific user to notify
  isFallback?: boolean; // If true, this is a fallback from WhatsApp
}

export interface SendOrderSMSResult {
  success: boolean;
  notificationLogId?: string;
  error?: string;
}

const QUIET_HOURS_START = 22; // 10 PM
const QUIET_HOURS_END = 8; // 8 AM
const MAX_RETRIES = 3;

// Emergency events that bypass quiet hours
const EMERGENCY_EVENTS: OrderLifecycleEvent[] = ['ORDER_OUT_FOR_DELIVERY', 'ORDER_DELIVERED'];

/**
 * Get store SMS notification configuration
 */
async function getStoreSMSConfig(
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
  smsFallbackEnabled: boolean; // Use SMS as fallback if WhatsApp fails
}> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const store = await Store.findById(storeObjId).select('metadata').lean();
  const config = (store as any)?.metadata?.smsNotifications || {};

  return {
    enabled: config.enabled !== false,
    customerEnabled: config.customerEnabled !== false,
    supplierEnabled: config.supplierEnabled !== false,
    resellerEnabled: config.resellerEnabled !== false,
    quietHoursEnabled: config.quietHoursEnabled !== false,
    quietHoursStart: config.quietHoursStart || QUIET_HOURS_START,
    quietHoursEnd: config.quietHoursEnd || QUIET_HOURS_END,
    enabledEvents: config.enabledEvents || [], // Empty array = all events enabled
    smsFallbackEnabled: config.smsFallbackEnabled !== false, // Default: enabled
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
  role: SMSAudience,
  userId?: mongoose.Types.ObjectId | string
): Promise<{ phoneNumber: string; user: any } | null> {
  let targetUser: any = null;

  if (role === 'customer') {
    if (order.customerId) {
      const customerObjId = typeof order.customerId === 'string' ? new mongoose.Types.ObjectId(order.customerId) : order.customerId;
      targetUser = await User.findById(customerObjId).select('phoneNumber smsOptIn name').lean();
    } else if (order.customerEmail) {
      // Try to find user by email
      targetUser = await User.findOne({ email: order.customerEmail }).select('phoneNumber smsOptIn name').lean();
    }
  } else if (role === 'supplier') {
    if (order.supplierId) {
      const supplierObjId = typeof order.supplierId === 'string' ? new mongoose.Types.ObjectId(order.supplierId) : order.supplierId;
      targetUser = await User.findById(supplierObjId).select('phoneNumber smsOptIn name').lean();
    } else if (userId) {
      const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      targetUser = await User.findById(userObjId).select('phoneNumber smsOptIn name').lean();
    }
  } else if (role === 'reseller') {
    // Reseller is the store owner
    const store = await Store.findById(order.storeId).select('ownerId').lean();
    if (store?.ownerId) {
      const ownerObjId = typeof store.ownerId === 'string' ? new mongoose.Types.ObjectId(store.ownerId) : store.ownerId;
      targetUser = await User.findById(ownerObjId).select('phoneNumber smsOptIn name').lean();
    }
  }

  if (!targetUser || !targetUser.phoneNumber) {
    return null; // No phone number available
  }

  if (!targetUser.smsOptIn) {
    return null; // User has not opted in
  }

  return {
    phoneNumber: targetUser.phoneNumber,
    user: targetUser,
  };
}

/**
 * Send SMS notification for order event
 */
export async function sendOrderSMS(
  params: SendOrderSMSParams
): Promise<SendOrderSMSResult> {
  const { orderId, storeId, eventType, role, userId, isFallback = false } = params;

  try {
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;

    // STEP 1: Get store configuration
    const config = await getStoreSMSConfig(storeObjId);
    if (!config.enabled) {
      return { success: false, error: 'SMS notifications are disabled for this store' };
    }

    // Check role-specific enablement
    if (role === 'customer' && !config.customerEnabled) {
      return { success: false, error: 'Customer SMS notifications are disabled' };
    }
    if (role === 'supplier' && !config.supplierEnabled) {
      return { success: false, error: 'Supplier SMS notifications are disabled' };
    }
    if (role === 'reseller' && !config.resellerEnabled) {
      return { success: false, error: 'Reseller SMS notifications are disabled' };
    }

    // Check if event is enabled
    if (config.enabledEvents.length > 0 && !config.enabledEvents.includes(eventType)) {
      return { success: false, error: `Event ${eventType} is disabled for this store` };
    }

    // STEP 2: Check for existing notification (idempotency)
    // Max 1 SMS per event per order per role
    const existingLog = await SMSNotificationLog.findOne({
      orderId: orderObjId,
      eventType,
      role,
      status: { $in: ['queued', 'sent', 'delivered'] },
    }).lean();

    if (existingLog) {
      return {
        success: true,
        notificationLogId: existingLog._id.toString(),
        error: 'SMS already sent (idempotency)',
      };
    }

    // STEP 3: Get order
    const order = await Order.findById(orderObjId).lean();
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // STEP 4: Resolve template
    const template = getSMSTemplate(eventType, role);
    if (!template) {
      return { success: false, error: `No template found for event ${eventType} and role ${role}` };
    }

    // STEP 5: Resolve recipient
    const recipient = await resolveRecipient(order, role, userId);
    if (!recipient) {
      return { success: false, error: 'No recipient found or user has not opted in' };
    }

    // STEP 6: Check quiet hours (unless emergency event or fallback)
    const isEmergency = EMERGENCY_EVENTS.includes(eventType);
    if (config.quietHoursEnabled && !isEmergency && !isFallback && isQuietHours(config.quietHoursStart, config.quietHoursEnd)) {
      // Queue for later (outside quiet hours)
      const notificationLog = new SMSNotificationLog({
        storeId: storeObjId,
        orderId: orderObjId,
        userId: recipient.user._id,
        role,
        phoneNumber: recipient.phoneNumber,
        eventType,
        message: '', // Will be set when sent
        status: 'queued',
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
        error: 'SMS queued for quiet hours',
      };
    }

    // STEP 7: Build template variables
    const store = await Store.findById(storeObjId).select('name').lean();
    const templateVariables = await buildTemplateVariables(order, role, store, recipient.user);

    // STEP 8: Render SMS message
    const message = renderSMSTemplate(template.template, templateVariables);

    // STEP 9: Send via SMS provider
    const sendResult = await smsProvider.sendSMS({
      to: recipient.phoneNumber,
      message,
    });

    // STEP 10: Save log entry
    const notificationLog = new SMSNotificationLog({
      storeId: storeObjId,
      orderId: orderObjId,
      userId: recipient.user._id,
      role,
      phoneNumber: recipient.phoneNumber,
      eventType,
      message,
      status: sendResult.success ? 'sent' : 'failed',
      providerMessageId: sendResult.providerMessageId,
      sentAt: sendResult.success ? new Date() : undefined,
      failedAt: !sendResult.success ? new Date() : undefined,
      failureReason: !sendResult.success ? sendResult.error : undefined,
      retryCount: 0,
      metadata: {
        isFallback,
        templateVariables,
      },
    });
    await notificationLog.save();

    // STEP 11: Audit log
    await logAudit({
      storeId: storeObjId.toString(),
      actorRole: 'system',
      action: sendResult.success ? 'SMS_NOTIFICATION_SENT' : 'SMS_NOTIFICATION_FAILED',
      entityType: 'SMSNotificationLog',
      entityId: notificationLog._id.toString(),
      description: `SMS notification ${sendResult.success ? 'sent' : 'failed'}: ${eventType} for order ${order.orderNumber || order.orderId}`,
      metadata: {
        orderId: orderObjId.toString(),
        eventType,
        role,
        phoneNumber: recipient.phoneNumber,
        success: sendResult.success,
        error: sendResult.error,
        isFallback,
      },
    });

    // STEP 12: Emit event
    if (sendResult.success) {
      eventStreamEmitter.emit('event', {
        eventType: 'SMS_ORDER_NOTIFICATION_SENT',
        payload: {
          orderId: orderObjId.toString(),
          eventType,
          role,
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
    console.error('[SMS NOTIFICATION] Error sending SMS:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

