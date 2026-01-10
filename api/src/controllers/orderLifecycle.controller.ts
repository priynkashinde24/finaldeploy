import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { transitionOrder, canReturnOrder } from '../services/orderLifecycle.service';
import { OrderStatus } from '../constants/orderStatus';
import { getAllowedTransitions } from '../order/orderStateMachine';
import { Order } from '../models/Order';
import { z } from 'zod';

/**
 * Order Lifecycle Controller
 * 
 * PURPOSE:
 * - Expose API endpoints for order state transitions
 * - Enforce role-based permissions
 * - Call lifecycle service ONLY (never update order directly)
 * 
 * RULES:
 * - All transitions go through lifecycle service
 * - No direct order.status updates
 * - Role validation at controller level
 */

const transitionOrderSchema = z.object({
  reason: z.string().optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  returnReason: z.string().optional(),
});

/**
 * PATCH /orders/:id/confirm
 * Confirm order (payment confirmed)
 */
export const confirmOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const result = await transitionOrder({
      orderId: id,
      toStatus: OrderStatus.CONFIRMED,
      actorRole: 'system',
      actorId: currentUser.id,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to confirm order', 400);
      return;
    }

    sendSuccess(res, { order: result.order, sideEffects: result.sideEffects }, 'Order confirmed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /orders/:id/process
 * Start processing order (supplier)
 */
export const processOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser || (currentUser.role !== 'supplier' && currentUser.role !== 'admin')) {
      sendError(res, 'Supplier or admin access required', 403);
      return;
    }

    const result = await transitionOrder({
      orderId: id,
      toStatus: OrderStatus.PROCESSING,
      actorRole: currentUser.role === 'admin' ? 'admin' : 'supplier',
      actorId: currentUser.id,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to process order', 400);
      return;
    }

    sendSuccess(res, { order: result.order, sideEffects: result.sideEffects }, 'Order processing started');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /orders/:id/ship
 * Ship order (supplier)
 */
export const shipOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const validatedData = transitionOrderSchema.parse(req.body);

    if (!currentUser || (currentUser.role !== 'supplier' && currentUser.role !== 'admin')) {
      sendError(res, 'Supplier or admin access required', 403);
      return;
    }

    if (!validatedData.trackingNumber) {
      sendError(res, 'Tracking number is required', 400);
      return;
    }

    const result = await transitionOrder({
      orderId: id,
      toStatus: OrderStatus.SHIPPED,
      actorRole: currentUser.role === 'admin' ? 'admin' : 'supplier',
      actorId: currentUser.id,
      metadata: {
        trackingNumber: validatedData.trackingNumber,
        notes: validatedData.notes,
      },
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to ship order', 400);
      return;
    }

    sendSuccess(res, { order: result.order, sideEffects: result.sideEffects }, 'Order shipped successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /orders/:id/deliver
 * Mark order as delivered (delivery system)
 */
export const deliverOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'delivery')) {
      sendError(res, 'Delivery or admin access required', 403);
      return;
    }

    const result = await transitionOrder({
      orderId: id,
      toStatus: OrderStatus.DELIVERED,
      actorRole: currentUser.role === 'admin' ? 'admin' : 'delivery',
      actorId: currentUser.id,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to deliver order', 400);
      return;
    }

    sendSuccess(res, { order: result.order, sideEffects: result.sideEffects }, 'Order delivered successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /orders/:id/cancel
 * Cancel order (customer or admin)
 */
export const cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const validatedData = transitionOrderSchema.parse(req.body);

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Check if user owns the order or is admin
    const order = await Order.findById(id).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    const isOwner = order.customerId?.toString() === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      sendError(res, 'You can only cancel your own orders', 403);
      return;
    }

    const result = await transitionOrder({
      orderId: id,
      toStatus: OrderStatus.CANCELLED,
      actorRole: isAdmin ? 'admin' : 'customer',
      actorId: currentUser.id,
      metadata: {
        reason: validatedData.reason || 'Cancelled by customer',
        notes: validatedData.notes,
      },
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to cancel order', 400);
      return;
    }

    sendSuccess(res, { order: result.order, sideEffects: result.sideEffects }, 'Order cancelled successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /orders/:id/return
 * Return order (customer)
 */
export const returnOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const validatedData = transitionOrderSchema.parse(req.body);

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Check if user owns the order
    const order = await Order.findById(id).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    const isOwner = order.customerId?.toString() === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      sendError(res, 'You can only return your own orders', 403);
      return;
    }

    // Check return eligibility
    const returnCheck = await canReturnOrder(id);
    if (!returnCheck.allowed) {
      sendError(res, returnCheck.reason || 'Return not allowed', 400);
      return;
    }

    if (!validatedData.returnReason) {
      sendError(res, 'Return reason is required', 400);
      return;
    }

    const result = await transitionOrder({
      orderId: id,
      toStatus: OrderStatus.RETURNED,
      actorRole: isAdmin ? 'admin' : 'customer',
      actorId: currentUser.id,
      metadata: {
        returnReason: validatedData.returnReason,
        notes: validatedData.notes,
      },
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to return order', 400);
      return;
    }

    sendSuccess(res, { order: result.order, sideEffects: result.sideEffects }, 'Order returned successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /orders/:id/refund
 * Refund order (admin only)
 */
export const refundOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const result = await transitionOrder({
      orderId: id,
      toStatus: OrderStatus.REFUNDED,
      actorRole: 'admin',
      actorId: currentUser.id,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to refund order', 400);
      return;
    }

    sendSuccess(res, { order: result.order, sideEffects: result.sideEffects }, 'Order refunded successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /orders/:id/transitions
 * Get allowed transitions for order
 */
export const getAllowedTransitionsForOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const order = await Order.findById(id).lean();
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    const currentStatus = (order.orderStatus || order.status) as OrderStatus;
    const actorRole = currentUser.role === 'admin' ? 'admin' : 
                     currentUser.role === 'supplier' ? 'supplier' :
                     currentUser.role === 'delivery' ? 'delivery' : 'customer';

    const allowedTransitions = getAllowedTransitions(currentStatus, actorRole);

    sendSuccess(res, {
      currentStatus,
      allowedTransitions,
      orderId: order.orderId,
    }, 'Allowed transitions retrieved');
  } catch (error) {
    next(error);
  }
};

