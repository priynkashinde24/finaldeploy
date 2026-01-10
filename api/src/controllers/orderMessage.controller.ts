import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Order } from '../models/Order';
import { OrderMessageThread } from '../models/OrderMessageThread';
import { OrderMessage, IOrderMessage } from '../models/OrderMessage';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import { z } from 'zod';

/**
 * Order Message Controller
 * 
 * PURPOSE:
 * - Handle customer messages related to orders
 * - Support multi-channel messages (in-app, email, WhatsApp, SMS)
 * - Keep full conversation history per order
 * - Allow admin / supplier / reseller replies
 * - Be auditable, role-aware, and secure
 * 
 * RULES:
 * - One thread per order (auto-created on first message)
 * - Messages are immutable
 * - Role-based access control
 * - Channel source always recorded
 */

// Validation schemas
const createMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  channel: z.enum(['in_app', 'email', 'whatsapp', 'sms']).default('in_app'),
  messageType: z.enum(['text', 'attachment', 'system_event']).default('text'),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().min(0),
  })).optional(),
  isInternal: z.boolean().optional().default(false), // For admin-only notes
});

const markReadSchema = z.object({
  role: z.enum(['customer', 'admin', 'supplier', 'reseller']),
});

/**
 * Validate order access based on role
 */
async function validateOrderAccess(
  order: any,
  user: any,
  storeId?: mongoose.Types.ObjectId | string
): Promise<{ allowed: boolean; error?: string }> {
  if (!user) {
    return { allowed: false, error: 'Authentication required' };
  }

  const userRole = user.role;
  const userStoreId = storeId || user.defaultStoreId;

  // Admin: Full access
  if (userRole === 'admin') {
    return { allowed: true };
  }

  // Customer: Only own orders
  if (userRole === 'customer' || !userRole) {
    const userId = typeof user.id === 'string' ? new mongoose.Types.ObjectId(user.id) : user.id;
    const orderCustomerId = order.customerId
      ? (typeof order.customerId === 'string' ? new mongoose.Types.ObjectId(order.customerId) : order.customerId)
      : null;

    if (orderCustomerId && userId.toString() === orderCustomerId.toString()) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: Not your order' };
  }

  // Supplier: Only orders they fulfill
  if (userRole === 'supplier') {
    const userId = typeof user.id === 'string' ? new mongoose.Types.ObjectId(user.id) : user.id;
    const orderSupplierId = order.supplierId
      ? (typeof order.supplierId === 'string' ? new mongoose.Types.ObjectId(order.supplierId) : order.supplierId)
      : null;

    // Check if supplier is in fulfillment snapshot
    const fulfillmentSnapshot = order.fulfillmentSnapshot;
    const isFulfillingOrder = fulfillmentSnapshot?.items?.some((item: any) => {
      const itemSupplierId = typeof item.supplierId === 'string' 
        ? new mongoose.Types.ObjectId(item.supplierId) 
        : item.supplierId;
      return itemSupplierId && itemSupplierId.toString() === userId.toString();
    });

    if (orderSupplierId && orderSupplierId.toString() === userId.toString()) {
      return { allowed: true };
    }
    if (isFulfillingOrder) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: Not your order to fulfill' };
  }

  // Reseller: Only own store orders
  if (userRole === 'reseller') {
    if (!userStoreId) {
      return { allowed: false, error: 'Store ID required' };
    }
    const storeObjId = typeof userStoreId === 'string' ? new mongoose.Types.ObjectId(userStoreId) : userStoreId;
    if (storeObjId.toString() === order.storeId.toString()) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: Not your store order' };
  }

  return { allowed: false, error: 'Invalid role' };
}

/**
 * Find or create message thread for order
 */
async function findOrCreateThread(
  orderId: string,
  storeId: mongoose.Types.ObjectId,
  customerId?: mongoose.Types.ObjectId | string | null
): Promise<{ thread: any; created: boolean }> {
  // Try to find existing thread
  let thread = await OrderMessageThread.findOne({ orderId, storeId }).lean();

  if (thread) {
    return { thread, created: false };
  }

  // Create new thread
  const newThread = await OrderMessageThread.create({
    orderId,
    storeId,
    customerId: customerId || null,
    status: 'open',
    lastMessageAt: new Date(),
  });

  thread = newThread.toObject();

  return { thread, created: true };
}

/**
 * Determine sender role from user context
 */
function getSenderRole(user: any): 'customer' | 'admin' | 'supplier' | 'reseller' | 'system' {
  if (!user) {
    return 'system';
  }
  if (user.role === 'admin') {
    return 'admin';
  }
  if (user.role === 'supplier') {
    return 'supplier';
  }
  if (user.role === 'reseller') {
    return 'reseller';
  }
  return 'customer';
}

/**
 * POST /orders/:id/messages
 * Create a new message in order thread
 */
export const createMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: orderId } = req.params;
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    // Validate request body
    const validatedData = createMessageSchema.parse(req.body);
    const { content, channel, messageType, attachments, isInternal } = validatedData;

    // STEP 1: Get order
    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // STEP 2: Validate order access
    const accessCheck = await validateOrderAccess(order, currentUser, storeId || order.storeId);
    if (!accessCheck.allowed) {
      sendError(res, accessCheck.error || 'Access denied', 403);
      return;
    }

    // STEP 3: Validate internal notes (only admin can create)
    if (isInternal && (!currentUser || currentUser.role !== 'admin')) {
      sendError(res, 'Only admins can create internal notes', 403);
      return;
    }

  // STEP 4: Find or create thread
  const threadResult = await findOrCreateThread(
    orderId,
    storeId || order.storeId,
    order.customerId
  );
  const thread = threadResult.thread;
  const created = threadResult.created;

    // STEP 5: Determine sender role and ID
    const senderRole = getSenderRole(currentUser);
    const senderId = currentUser?.id ? (typeof currentUser.id === 'string' ? new mongoose.Types.ObjectId(currentUser.id) : currentUser.id) : null;

    // STEP 6: Create message
    const message = await OrderMessage.create({
      threadId: thread._id,
      orderId,
      storeId: storeId || order.storeId,
      senderRole,
      senderId,
      channel,
      messageType,
      content,
      attachments: attachments || [],
      isRead: false,
      readBy: [],
      isInternal: isInternal || false,
    });

    // STEP 7: Update thread lastMessageAt
    await OrderMessageThread.findByIdAndUpdate(thread._id, {
      lastMessageAt: new Date(),
    });

    // STEP 8: Emit MESSAGE_CREATED event
    eventStreamEmitter.emit('event', {
      eventType: 'MESSAGE_CREATED',
      payload: {
        messageId: message._id.toString(),
        threadId: thread._id.toString(),
        orderId,
        storeId: (storeId || order.storeId).toString(),
        senderRole,
        channel,
        messageType,
      },
      storeId: (storeId || order.storeId).toString(),
      userId: currentUser?.id?.toString(),
      occurredAt: new Date(),
    });

    // STEP 9: Audit log
    await logAudit({
      req,
      action: 'MESSAGE_CREATED',
      entityType: 'OrderMessage',
      entityId: message._id.toString(),
      description: `Message created in order ${orderId} via ${channel}`,
      metadata: {
        orderId,
        threadId: thread._id.toString(),
        senderRole,
        channel,
        messageType,
        isInternal,
        threadCreated: created,
      },
    });

    sendSuccess(res, {
      message: {
        _id: message._id,
        threadId: thread._id,
        orderId,
        senderRole,
        channel,
        messageType,
        content,
        attachments: message.attachments,
        isInternal: message.isInternal,
        createdAt: message.createdAt,
      },
      thread: {
        _id: thread._id,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
      },
    }, 'Message created successfully', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, 'Validation error', 400, error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
      return;
    }
    next(error);
  }
};

/**
 * GET /orders/:id/messages
 * Get all messages for an order (with role-based filtering)
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: orderId } = req.params;
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    // STEP 1: Get order
    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // STEP 2: Validate order access
    const accessCheck = await validateOrderAccess(order, currentUser, storeId || order.storeId);
    if (!accessCheck.allowed) {
      sendError(res, accessCheck.error || 'Access denied', 403);
      return;
    }

    // STEP 3: Get thread
    const thread = await OrderMessageThread.findOne({ orderId, storeId: storeId || order.storeId }).lean();
    if (!thread) {
      sendSuccess(res, { messages: [], thread: null }, 'No messages found');
      return;
    }

    // STEP 4: Build query with role-based filtering
    const query: any = {
      threadId: thread._id,
      orderId,
    };

    // Filter internal messages (only admin can see)
    if (!currentUser || currentUser.role !== 'admin') {
      query.isInternal = false;
    }

    // STEP 5: Get messages
    const messages = await OrderMessage.find(query)
      .sort({ createdAt: 1 }) // Oldest first (chronological order)
      .lean();

    // STEP 6: Format response
    const formattedMessages = messages.map((msg: any) => ({
      _id: msg._id,
      senderRole: msg.senderRole,
      senderId: msg.senderId,
      channel: msg.channel,
      messageType: msg.messageType,
      content: msg.content,
      attachments: msg.attachments || [],
      isRead: msg.isRead,
      readBy: msg.readBy || [],
      isInternal: msg.isInternal,
      createdAt: msg.createdAt,
    }));

    sendSuccess(res, {
      messages: formattedMessages,
      thread: {
        _id: thread._id,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
        createdAt: thread.createdAt,
      },
    }, 'Messages retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /orders/:id/messages/:messageId/read
 * Mark message as read
 */
export const markMessageRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: orderId, messageId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Validate request body
    const validatedData = markReadSchema.parse(req.body);
    const { role } = validatedData;

    // STEP 1: Get order
    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // STEP 2: Validate order access
    const accessCheck = await validateOrderAccess(order, currentUser);
    if (!accessCheck.allowed) {
      sendError(res, accessCheck.error || 'Access denied', 403);
      return;
    }

    // STEP 3: Get message
    const message = await OrderMessage.findOne({
      _id: messageId,
      orderId,
    });

    if (!message) {
      sendError(res, 'Message not found', 404);
      return;
    }

    // STEP 4: Check if already read by this user
    const userId = typeof currentUser.id === 'string' ? new mongoose.Types.ObjectId(currentUser.id) : currentUser.id;
    const alreadyRead = message.readBy.some(
      (read: any) =>
        read.userId.toString() === userId.toString() && read.role === role
    );

    if (!alreadyRead) {
      // STEP 5: Add read receipt
      message.readBy.push({
        role,
        userId,
        readAt: new Date(),
      });

      // Update isRead if any read receipts exist
      if (message.readBy.length > 0) {
        message.isRead = true;
      }

      await message.save();

      // STEP 6: Emit MESSAGE_READ event
      eventStreamEmitter.emit('event', {
        eventType: 'MESSAGE_READ',
        payload: {
          messageId: message._id.toString(),
          orderId,
          readerRole: role,
          readerId: userId.toString(),
        },
        storeId: order.storeId.toString(),
        userId: currentUser.id.toString(),
        occurredAt: new Date(),
      });

      // STEP 7: Audit log
      await logAudit({
        req,
        action: 'MESSAGE_READ',
        entityType: 'OrderMessage',
        entityId: message._id.toString(),
        description: `Message read in order ${orderId}`,
        metadata: {
          orderId,
          messageId: message._id.toString(),
          readerRole: role,
        },
      });
    }

    sendSuccess(res, {
      message: {
        _id: message._id,
        isRead: message.isRead,
        readBy: message.readBy,
      },
    }, 'Message marked as read');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, 'Validation error', 400, error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/messages/search
 * Search and filter messages (admin only)
 */
export const searchMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const {
      keyword,
      status, // thread status: open, closed
      unread,
      orderStatus,
      channel,
      senderRole,
      page = '1',
      limit = '50',
    } = req.query;

    // Build query
    const query: any = {};

    // Keyword search (in content)
    if (keyword && typeof keyword === 'string') {
      query.content = { $regex: keyword, $options: 'i' };
    }

    // Filter by channel
    if (channel && typeof channel === 'string') {
      query.channel = channel;
    }

    // Filter by sender role
    if (senderRole && typeof senderRole === 'string') {
      query.senderRole = senderRole;
    }

    // Filter by unread
    if (unread === 'true') {
      query.isRead = false;
    }

    // Get threads matching status
    let threadIds: mongoose.Types.ObjectId[] = [];
    if (status || orderStatus) {
      const threadQuery: any = {};
      if (status && typeof status === 'string') {
        threadQuery.status = status;
      }

      // If filtering by order status, need to join with orders
      if (orderStatus && typeof orderStatus === 'string') {
        const orders = await Order.find({ orderStatus }).select('orderId').lean();
        const orderIds = orders.map((o: any) => o.orderId);
        threadQuery.orderId = { $in: orderIds };
      }

      const threads = await OrderMessageThread.find(threadQuery).select('_id').lean();
      threadIds = threads.map((t: any) => t._id);
      query.threadId = { $in: threadIds };
    }

    // Pagination
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Get messages
    const messages = await OrderMessage.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('threadId', 'orderId status')
      .lean();

    // Get total count
    const total = await OrderMessage.countDocuments(query);

    // Format response
    const formattedMessages = messages.map((msg: any) => ({
      _id: msg._id,
      threadId: msg.threadId,
      orderId: msg.orderId,
      senderRole: msg.senderRole,
      senderId: msg.senderId,
      channel: msg.channel,
      messageType: msg.messageType,
      content: msg.content,
      attachments: msg.attachments || [],
      isRead: msg.isRead,
      readBy: msg.readBy || [],
      isInternal: msg.isInternal,
      createdAt: msg.createdAt,
    }));

    sendSuccess(res, {
      messages: formattedMessages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    }, 'Messages retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /orders/:id/thread/close
 * Close message thread (admin only)
 */
export const closeThread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: orderId } = req.params;
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    // STEP 1: Get order
    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // STEP 2: Get thread
    const thread = await OrderMessageThread.findOne({
      orderId,
      storeId: order.storeId,
    });

    if (!thread) {
      sendError(res, 'Thread not found', 404);
      return;
    }

    // STEP 3: Close thread
    thread.status = 'closed';
    await thread.save();

    // STEP 4: Emit THREAD_CLOSED event
    eventStreamEmitter.emit('event', {
      eventType: 'THREAD_CLOSED',
      payload: {
        threadId: thread._id.toString(),
        orderId,
      },
      storeId: order.storeId.toString(),
      userId: currentUser.id.toString(),
      occurredAt: new Date(),
    });

    // STEP 5: Audit log
    await logAudit({
      req,
      action: 'THREAD_CLOSED',
      entityType: 'OrderMessageThread',
      entityId: thread._id.toString(),
      description: `Thread closed for order ${orderId}`,
      metadata: {
        orderId,
        threadId: thread._id.toString(),
      },
    });

    sendSuccess(res, {
      thread: {
        _id: thread._id,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
      },
    }, 'Thread closed successfully');
  } catch (error) {
    next(error);
  }
};

