import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { SMSNotificationLog } from '../models/SMSNotificationLog';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';

/**
 * SMS Webhook Controller
 *
 * PURPOSE:
 * - Handle inbound SMS messages (opt-out)
 * - Handle delivery status updates
 * - Compliance and opt-out management
 */

/**
 * POST /webhooks/sms/inbound
 * Handle inbound SMS messages (Twilio/MSG91/AWS SNS)
 */
export const handleInboundSMS = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Twilio format
    const { From, Body, MessageSid } = req.body;
    
    // MSG91 format (alternative)
    const { mobile, message, messageId } = req.body;
    
    // AWS SNS format (alternative)
    const { originationNumber, messageBody: snsMessageBody, messageId: snsMessageId } = req.body;

    // Determine provider and extract data
    let phoneNumber: string | null = null;
    let messageBody: string | null = null;
    let providerMessageId: string | null = null;

    if (From && Body) {
      // Twilio format
      phoneNumber = From.replace(/^\+/, '').trim();
      messageBody = Body.trim();
      providerMessageId = MessageSid;
    } else if (mobile && message) {
      // MSG91 format
      phoneNumber = mobile.replace(/^\+/, '').trim();
      messageBody = message.trim();
      providerMessageId = messageId;
    } else if (originationNumber && snsMessageBody) {
      // AWS SNS format
      phoneNumber = originationNumber.replace(/^\+/, '').trim();
      messageBody = snsMessageBody.trim();
      providerMessageId = snsMessageId;
    }

    if (!phoneNumber || !messageBody) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const messageUpper = messageBody.toUpperCase();

    // Check for opt-out keywords
    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'QUIT', 'CANCEL'];
    const isOptOut = optOutKeywords.some((keyword) => messageUpper.includes(keyword));

    if (isOptOut) {
      // Find user by phone number (normalize for search)
      const phoneDigits = phoneNumber.replace(/\D/g, '');
      const user = await User.findOne({
        $or: [
          { phoneNumber: { $regex: phoneDigits, $options: 'i' } },
          { phone: { $regex: phoneDigits, $options: 'i' } },
        ],
      });

      if (user) {
        // Update opt-out status
        user.smsOptIn = false;
        user.smsOptOutAt = new Date();
        await user.save();

        // Cancel all queued SMS notifications for this user
        await SMSNotificationLog.updateMany(
          {
            userId: user._id,
            status: { $in: ['queued', 'sent'] },
          },
          {
            status: 'cancelled',
          }
        );

        // Audit log
        await logAudit({
          storeId: user.defaultStoreId?.toString() || 'unknown',
          actorRole: 'system',
          action: 'SMS_OPT_OUT',
          entityType: 'User',
          entityId: user._id.toString(),
          description: `User opted out of SMS messages via STOP command`,
          metadata: {
            userId: user._id.toString(),
            phoneNumber: phoneNumber,
            providerMessageId: providerMessageId,
          },
        });

        // Emit event
        eventStreamEmitter.emit('event', {
          eventType: 'SMS_OPT_OUT',
          payload: {
            userId: user._id.toString(),
            phoneNumber: phoneNumber,
          },
          storeId: user.defaultStoreId?.toString() || 'unknown',
          userId: user._id.toString(),
          occurredAt: new Date(),
        });
      }

      // Respond to provider (Twilio expects XML, others may expect JSON)
      if (From && Body) {
        // Twilio format
        res.type('text/xml');
        res.send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from SMS messages. Reply START to re-subscribe.</Message></Response>'
        );
      } else {
        // MSG91 / AWS SNS format
        res.status(200).json({ success: true, message: 'Opt-out processed' });
      }
      return;
    }

    // Handle opt-in keywords (START, YES, etc.)
    const optInKeywords = ['START', 'YES', 'SUBSCRIBE', 'OPT IN'];
    const isOptIn = optInKeywords.some((keyword) => messageUpper.includes(keyword));

    if (isOptIn) {
      const phoneDigits = phoneNumber.replace(/\D/g, '');
      const user = await User.findOne({
        $or: [
          { phoneNumber: { $regex: phoneDigits, $options: 'i' } },
          { phone: { $regex: phoneDigits, $options: 'i' } },
        ],
      });

      if (user) {
        user.smsOptIn = true;
        user.smsOptInAt = new Date();
        user.smsOptOutAt = undefined;
        await user.save();

        if (From && Body) {
          // Twilio format
          res.type('text/xml');
          res.send(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been subscribed to SMS messages. Reply STOP to unsubscribe.</Message></Response>'
          );
        } else {
          res.status(200).json({ success: true, message: 'Opt-in processed' });
        }
        return;
      }
    }

    // Default response (acknowledge receipt)
    if (From && Body) {
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } else {
      res.status(200).json({ success: true });
    }
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /webhooks/sms/status
 * Handle delivery status updates (Twilio/MSG91/AWS SNS)
 */
export const handleSMSStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Twilio format
    const { MessageSid, MessageStatus } = req.body;
    
    // MSG91 format (alternative)
    const { messageId, status } = req.body;
    
    // AWS SNS format (alternative)
    const { messageId: snsMessageId, delivery } = req.body;

    // Determine provider and extract data
    let providerMessageId: string | null = null;
    let messageStatus: string | null = null;

    if (MessageSid && MessageStatus) {
      // Twilio format
      providerMessageId = MessageSid;
      messageStatus = MessageStatus;
    } else if (messageId && status) {
      // MSG91 format
      providerMessageId = messageId;
      messageStatus = status;
    } else if (snsMessageId && delivery) {
      // AWS SNS format
      providerMessageId = snsMessageId;
      messageStatus = delivery.deliveryStatus || delivery.status;
    }

    if (!providerMessageId || !messageStatus) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Find SMS notification log by provider message ID
    const notificationLog = await SMSNotificationLog.findOne({
      providerMessageId: providerMessageId,
    });

    if (notificationLog) {
      if (messageStatus === 'delivered' || messageStatus === 'DELIVERED') {
        notificationLog.status = 'delivered';
        notificationLog.deliveredAt = new Date();
      } else if (messageStatus === 'failed' || messageStatus === 'FAILED' || messageStatus === 'undelivered' || messageStatus === 'UNDELIVERED') {
        notificationLog.status = 'failed';
        notificationLog.failedAt = new Date();
        notificationLog.failureReason = `Provider status: ${messageStatus}`;
      }

      await notificationLog.save();

      // Audit log
      await logAudit({
        storeId: notificationLog.storeId.toString(),
        actorRole: 'system',
        action: `SMS_NOTIFICATION_${messageStatus.toUpperCase()}`,
        entityType: 'SMSNotificationLog',
        entityId: notificationLog._id.toString(),
        description: `SMS order notification ${providerMessageId} status updated to ${messageStatus}`,
        metadata: {
          orderId: notificationLog.orderId.toString(),
          eventType: notificationLog.eventType,
          role: notificationLog.role,
          status: messageStatus,
        },
      });
    }

    // Acknowledge webhook
    res.status(200).send('OK');
  } catch (error: any) {
    next(error);
  }
};

