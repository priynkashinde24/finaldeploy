import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { User } from '../models/User';
import { WhatsAppMessageLog } from '../models/WhatsAppMessageLog';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';

/**
 * WhatsApp Webhook Controller
 *
 * PURPOSE:
 * - Handle inbound WhatsApp messages (opt-out)
 * - Handle delivery status updates
 * - Compliance and opt-out management
 */

/**
 * POST /webhooks/whatsapp/inbound
 * Handle inbound WhatsApp messages (Twilio/Meta BSP)
 */
export const handleInboundWhatsApp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { From, Body, MessageSid } = req.body; // Twilio format

    if (!From || !Body) {
      sendError(res, 'Missing required fields', 400);
      return;
    }

    // Extract phone number (remove whatsapp: prefix if present)
    const phoneNumber = From.replace(/^whatsapp:/, '').trim();
    const messageBody = Body.trim().toUpperCase();

    // Check for opt-out keywords
    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'QUIT', 'CANCEL'];
    const isOptOut = optOutKeywords.some((keyword) => messageBody.includes(keyword));

    if (isOptOut) {
      // Find user by phone number
      const user = await User.findOne({
        $or: [
          { phoneNumber: { $regex: phoneNumber.replace(/\D/g, ''), $options: 'i' } },
          { phone: { $regex: phoneNumber.replace(/\D/g, ''), $options: 'i' } },
        ],
      });

      if (user) {
        // Update opt-out status
        user.whatsappOptIn = false;
        user.whatsappOptOutAt = new Date();
        await user.save();

        // Cancel all queued WhatsApp messages for this user (recovery + notifications)
        await WhatsAppMessageLog.updateMany(
          {
            userId: user._id,
            status: 'queued',
          },
          {
            status: 'cancelled',
          }
        );

        // Cancel all queued WhatsApp order notifications for this user
        const { WhatsAppNotificationLog } = await import('../models/WhatsAppNotificationLog');
        await WhatsAppNotificationLog.updateMany(
          {
            userId: user._id,
            status: 'queued',
          },
          {
            status: 'cancelled',
          }
        );

        // Audit log
        await logAudit({
          storeId: user.defaultStoreId?.toString() || 'unknown',
          actorRole: 'system',
          action: 'WHATSAPP_OPT_OUT',
          entityType: 'User',
          entityId: user._id.toString(),
          description: `User opted out of WhatsApp messages via STOP command`,
          metadata: {
            userId: user._id.toString(),
            phoneNumber: phoneNumber,
            messageSid: MessageSid,
          },
        });

        // Emit event
        eventStreamEmitter.emit('event', {
          eventType: 'WHATSAPP_OPT_OUT',
          payload: {
            userId: user._id.toString(),
            phoneNumber: phoneNumber,
          },
          storeId: user.defaultStoreId?.toString() || 'unknown',
          userId: user._id.toString(),
          occurredAt: new Date(),
        });
      }

      // Respond to Twilio (required for webhook)
      res.type('text/xml');
      res.send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from WhatsApp messages. Reply START to re-subscribe.</Message></Response>'
      );
      return;
    }

    // Handle other inbound messages (e.g., START to opt-in)
    const optInKeywords = ['START', 'YES', 'SUBSCRIBE', 'OPT IN'];
    const isOptIn = optInKeywords.some((keyword) => messageBody.includes(keyword));

    if (isOptIn) {
      const user = await User.findOne({
        $or: [
          { phoneNumber: { $regex: phoneNumber.replace(/\D/g, ''), $options: 'i' } },
          { phone: { $regex: phoneNumber.replace(/\D/g, ''), $options: 'i' } },
        ],
      });

      if (user) {
        user.whatsappOptIn = true;
        user.whatsappOptInAt = new Date();
        user.whatsappOptOutAt = undefined;
        await user.save();

        res.type('text/xml');
        res.send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been subscribed to WhatsApp messages. Reply STOP to unsubscribe.</Message></Response>'
        );
        return;
      }
    }

    // Default response (acknowledge receipt)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /webhooks/whatsapp/status
 * Handle delivery status updates (Twilio/Meta BSP)
 */
export const handleWhatsAppStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { MessageSid, MessageStatus } = req.body; // Twilio format

    if (!MessageSid || !MessageStatus) {
      sendError(res, 'Missing required fields', 400);
      return;
    }

    // Find message log by provider message ID (recovery messages)
    const messageLog = await WhatsAppMessageLog.findOne({
      providerMessageId: MessageSid,
    });

    if (messageLog) {
      // Update status
      if (MessageStatus === 'delivered') {
        messageLog.status = 'delivered';
        messageLog.deliveredAt = new Date();

        // Update metrics
        const { WhatsAppRecoveryMetrics } = await import('../models/WhatsAppRecoveryMetrics');
        const metrics = await WhatsAppRecoveryMetrics.findOne({
          messageLogId: messageLog._id,
        });

        if (metrics) {
          metrics.deliveredAt = new Date();
          await metrics.save();
        }
      } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        messageLog.status = 'failed';
        messageLog.errorMessage = `Provider status: ${MessageStatus}`;
      }

      await messageLog.save();
    }

    // Also update WhatsAppNotificationLog for order notifications
    const { WhatsAppNotificationLog } = await import('../models/WhatsAppNotificationLog');
    const notificationLog = await WhatsAppNotificationLog.findOne({
      providerMessageId: MessageSid,
    });

    if (notificationLog) {
      if (MessageStatus === 'delivered') {
        notificationLog.status = 'delivered';
        notificationLog.deliveredAt = new Date();
      } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        notificationLog.status = 'failed';
        notificationLog.failedAt = new Date();
        notificationLog.failureReason = `Provider status: ${MessageStatus}`;
      }

      await notificationLog.save();

      // Audit log
      await logAudit({
        storeId: notificationLog.storeId.toString(),
        actorRole: 'system',
        action: `WHATSAPP_ORDER_NOTIFICATION_${MessageStatus.toUpperCase()}`,
        entityType: 'WhatsAppNotificationLog',
        entityId: notificationLog._id.toString(),
        description: `WhatsApp order notification ${MessageSid} status updated to ${MessageStatus}`,
        metadata: {
          orderId: notificationLog.orderId.toString(),
          eventType: notificationLog.eventType,
          role: notificationLog.role,
          status: MessageStatus,
        },
      });
    }

    // Acknowledge webhook
    res.status(200).send('OK');
  } catch (error: any) {
    next(error);
  }
};

