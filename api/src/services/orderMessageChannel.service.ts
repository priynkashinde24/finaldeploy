import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { OrderMessageThread } from '../models/OrderMessageThread';
import { OrderMessage } from '../models/OrderMessage';
import { User } from '../models/User';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';

/**
 * Order Message Channel Integration Service
 * 
 * PURPOSE:
 * - Map inbound messages from external channels (email, WhatsApp, SMS) to order threads
 * - Auto-create messages in order conversation history
 * - Support order lookup via orderNumber, email, phone
 * 
 * RULES:
 * - One thread per order (auto-created if needed)
 * - Channel source always recorded
 * - Messages are immutable
 */

export interface CreateMessageFromChannelParams {
  orderNumber?: string;
  // Order lookup: orderNumber, email, or phone
  customerEmail?: string;
  customerPhone?: string;
  // Message content
  content: string;
  channel: 'email' | 'whatsapp' | 'sms';
  senderPhone?: string; // For WhatsApp/SMS
  senderEmail?: string; // For email
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  // Optional metadata
  externalMessageId?: string; // Provider message ID
  metadata?: Record<string, any>;
}

export interface CreateMessageFromChannelResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  orderId?: string;
  error?: string;
}

/**
 * Find order by orderNumber, email, or phone
 */
async function findOrderByReference(
  orderNumber?: string,
  email?: string,
  phone?: string
): Promise<any | null> {
  const query: any = {};

  if (orderNumber) {
    query.orderNumber = orderNumber;
  } else if (email) {
    query.customerEmail = email.toLowerCase();
  } else if (phone) {
    // Normalize phone number (remove +, spaces, etc.)
    const normalizedPhone = phone.replace(/\D/g, '');
    // Try to find by phone in customer records or order
    // For now, we'll search by email if available, or use orderNumber
    // In production, you might want to add phone field to Order model
  }

  if (Object.keys(query).length === 0) {
    return null;
  }

  return await Order.findOne(query).lean();
}

/**
 * Find user by phone or email
 */
async function findUserByContact(
  phone?: string,
  email?: string
): Promise<any | null> {
  if (phone) {
    const normalizedPhone = phone.replace(/\D/g, '');
    const user = await User.findOne({
      $or: [
        { phoneNumber: { $regex: normalizedPhone, $options: 'i' } },
        { phone: { $regex: normalizedPhone, $options: 'i' } },
      ],
    }).lean();
    if (user) return user;
  }

  if (email) {
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    if (user) return user;
  }

  return null;
}

/**
 * Create order message from external channel (email, WhatsApp, SMS)
 * 
 * This function is called by webhook handlers when inbound messages arrive
 */
export async function createMessageFromChannel(
  params: CreateMessageFromChannelParams
): Promise<CreateMessageFromChannelResult> {
  const {
    orderNumber,
    customerEmail,
    customerPhone,
    content,
    channel,
    senderPhone,
    senderEmail,
    attachments,
    externalMessageId,
    metadata = {},
  } = params;

  try {
    // STEP 1: Find order
    const order = await findOrderByReference(orderNumber, customerEmail || senderEmail, customerPhone || senderPhone);

    if (!order) {
      // Order not found - could be a general inquiry, not order-specific
      // For now, we'll return error. In production, you might want to create a general support thread
      return {
        success: false,
        error: `Order not found. Please include order number in your message.`,
      };
    }

    // STEP 2: Find or create user
    let customerId: mongoose.Types.ObjectId | null = null;
    if (order.customerId) {
      customerId = typeof order.customerId === 'string' 
        ? new mongoose.Types.ObjectId(order.customerId) 
        : order.customerId;
    } else {
      // Try to find user by email/phone
      const user = await findUserByContact(customerPhone || senderPhone, customerEmail || senderEmail);
      if (user) {
        customerId = user._id;
      }
    }

    // STEP 3: Find or create thread
    const storeId = typeof order.storeId === 'string' 
      ? new mongoose.Types.ObjectId(order.storeId) 
      : order.storeId;

    let thread = await OrderMessageThread.findOne({
      orderId: order.orderId,
      storeId,
    }).lean();

    if (!thread) {
      const newThread = await OrderMessageThread.create({
        orderId: order.orderId,
        storeId,
        customerId,
        status: 'open',
        lastMessageAt: new Date(),
      });
      thread = newThread.toObject();
    }

    // STEP 4: Create message
    const threadId = typeof thread._id === 'string' ? new mongoose.Types.ObjectId(thread._id) : thread._id;
    const message = await OrderMessage.create({
      threadId,
      orderId: order.orderId,
      storeId,
      senderRole: 'customer',
      senderId: customerId,
      channel,
      messageType: 'text',
      content,
      attachments: attachments || [],
      isRead: false,
      readBy: [],
      isInternal: false,
    });

    // STEP 5: Update thread
    await OrderMessageThread.findByIdAndUpdate(threadId, {
      lastMessageAt: new Date(),
    });

    // STEP 6: Emit event
    const threadIdStr = typeof thread._id === 'string' ? thread._id : thread._id.toString();
    eventStreamEmitter.emit('event', {
      eventType: 'MESSAGE_CREATED',
      payload: {
        messageId: message._id.toString(),
        threadId: threadIdStr,
        orderId: order.orderId,
        storeId: storeId.toString(),
        senderRole: 'customer',
        channel,
        source: 'inbound_channel',
        externalMessageId,
      },
      storeId: storeId.toString(),
      userId: customerId?.toString(),
      occurredAt: new Date(),
    });

    // STEP 7: Audit log
    await logAudit({
      action: 'MESSAGE_CREATED',
      entityType: 'OrderMessage',
      entityId: message._id.toString(),
      description: `Inbound ${channel} message created for order ${order.orderId}`,
      metadata: {
        orderId: order.orderId,
        threadId: threadIdStr,
        channel,
        externalMessageId,
        ...metadata,
      },
      actorRole: 'system',
    });

    return {
      success: true,
      messageId: message._id.toString(),
      threadId: threadIdStr,
      orderId: order.orderId,
    };
  } catch (error: any) {
    console.error('[ORDER MESSAGE CHANNEL] Error creating message from channel:', error);
    return {
      success: false,
      error: error.message || 'Failed to create message from channel',
    };
  }
}

/**
 * Create system event message (order status updates, courier updates, etc.)
 */
export async function createSystemEventMessage(
  orderId: string,
  storeId: mongoose.Types.ObjectId | string,
  eventType: string,
  content: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

    // Find or create thread
    let thread = await OrderMessageThread.findOne({
      orderId,
      storeId: storeObjId,
    }).lean();

    let existingThread = await OrderMessageThread.findOne({
      orderId,
      storeId: storeObjId,
    }).lean();

    if (!existingThread) {
      const order = await Order.findOne({ orderId }).lean();
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      const newThread = await OrderMessageThread.create({
        orderId,
        storeId: storeObjId,
        customerId: order.customerId || null,
        status: 'open',
        lastMessageAt: new Date(),
      });
      existingThread = newThread.toObject();
    }

    // Create system event message
    const threadId = typeof existingThread._id === 'string' ? new mongoose.Types.ObjectId(existingThread._id) : existingThread._id;
    const message = await OrderMessage.create({
      threadId,
      orderId,
      storeId: storeObjId,
      senderRole: 'system',
      senderId: null,
      channel: 'in_app',
      messageType: 'system_event',
      content,
      attachments: [],
      isRead: false,
      readBy: [],
      isInternal: false,
    });

    // Update thread
    await OrderMessageThread.findByIdAndUpdate(threadId, {
      lastMessageAt: new Date(),
    });

    // Emit event
    const threadIdStr = typeof existingThread._id === 'string' ? existingThread._id : existingThread._id.toString();
    eventStreamEmitter.emit('event', {
      eventType: 'MESSAGE_CREATED',
      payload: {
        messageId: message._id.toString(),
        threadId: threadIdStr,
        orderId,
        storeId: storeObjId.toString(),
        senderRole: 'system',
        channel: 'in_app',
        messageType: 'system_event',
        eventType,
      },
      storeId: storeObjId.toString(),
      occurredAt: new Date(),
    });

    return {
      success: true,
      messageId: message._id.toString(),
    };
  } catch (error: any) {
    console.error('[ORDER MESSAGE CHANNEL] Error creating system event message:', error);
    return {
      success: false,
      error: error.message || 'Failed to create system event message',
    };
  }
}

