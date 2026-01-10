import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { createRMA, approveRMA, rejectRMA, receiveRMA } from '../services/rma.service';
import { RMA } from '../models/RMA';
import { Order } from '../models/Order';

/**
 * RMA Controller
 *
 * PURPOSE:
 * - Handle RMA request creation
 * - Approve/reject RMAs (admin/supplier)
 * - Track RMA status
 * - View RMA details
 */

// Validation schemas
const createRMASchema = z.object({
  items: z.array(
    z.object({
      globalVariantId: z.string().or(z.instanceof(mongoose.Types.ObjectId)),
      quantity: z.number().int().positive(),
      reason: z.string().min(1),
      condition: z.enum(['sealed', 'opened', 'damaged']),
    })
  ),
  refundMethod: z.enum(['original', 'wallet', 'cod_adjustment']),
});

const rejectRMASchema = z.object({
  reason: z.string().min(1),
});

/**
 * POST /orders/:orderId/rma
 * Create RMA request
 */
export const createRMARequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const { orderId } = req.params;
    const validatedData = createRMASchema.parse(req.body);

    const result = await createRMA({
      orderId,
      items: validatedData.items,
      refundMethod: validatedData.refundMethod,
      storeId,
      customerId: currentUser.id,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to create RMA', 400);
      return;
    }

    sendSuccess(res, {
      rma: result.rma,
      message: 'RMA request created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /rma/:id
 * Get RMA details
 */
export const getRMA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const { id } = req.params;
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const rma = await RMA.findOne({
      _id: id,
      storeId: storeObjId,
    })
      .populate('orderId', 'orderNumber orderId orderStatus paymentMethod')
      .populate('customerId', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .lean();

    if (!rma) {
      sendError(res, 'RMA not found', 404);
      return;
    }

    // Check access: customer can only see their own RMAs
    if (currentUser.role === 'customer' && rma.customerId?.toString() !== currentUser.id) {
      sendError(res, 'Access denied', 403);
      return;
    }

    sendSuccess(res, { rma });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /rma
 * List RMAs (with filters)
 */
export const listRMAs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const { status, orderId, customerId, page = 1, limit = 20 } = req.query;

    const filter: any = { storeId: storeObjId };

    // Role-based filtering
    if (currentUser.role === 'customer') {
      filter.customerId = new mongoose.Types.ObjectId(currentUser.id);
    }

    if (status) {
      filter.status = status;
    }

    if (orderId) {
      const order = await Order.findOne({ orderId, storeId: storeObjId }).select('_id').lean();
      if (order) {
        filter.orderId = order._id;
      } else {
        sendSuccess(res, { rmas: [], total: 0, page: Number(page), limit: Number(limit) });
        return;
      }
    }

    if (customerId) {
      filter.customerId = new mongoose.Types.ObjectId(customerId as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rmas, total] = await Promise.all([
      RMA.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('orderId', 'orderNumber orderId orderStatus')
        .populate('customerId', 'name email')
        .lean(),
      RMA.countDocuments(filter),
    ]);

    sendSuccess(res, {
      rmas,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /rma/:id/approve
 * Approve RMA (admin/supplier only)
 */
export const approveRMARequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    // Check permissions
    if (currentUser.role !== 'admin' && currentUser.role !== 'supplier') {
      sendError(res, 'Only admin or supplier can approve RMAs', 403);
      return;
    }

    const { id } = req.params;

    const result = await approveRMA({
      rmaId: id,
      approvedBy: currentUser.id,
      storeId,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to approve RMA', 400);
      return;
    }

    sendSuccess(res, {
      rma: result.rma,
      message: 'RMA approved successfully',
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /rma/:id/reject
 * Reject RMA (admin/supplier only)
 */
export const rejectRMARequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    // Check permissions
    if (currentUser.role !== 'admin' && currentUser.role !== 'supplier') {
      sendError(res, 'Only admin or supplier can reject RMAs', 403);
      return;
    }

    const { id } = req.params;
    const validatedData = rejectRMASchema.parse(req.body);

    const result = await rejectRMA({
      rmaId: id,
      rejectedBy: currentUser.id,
      reason: validatedData.reason,
      storeId,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to reject RMA', 400);
      return;
    }

    sendSuccess(res, {
      rma: result.rma,
      message: 'RMA rejected',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /rma/:id/receive
 * Receive RMA items (inventory reversal + refund)
 */
export const receiveRMAItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    // Check permissions
    if (currentUser.role !== 'admin' && currentUser.role !== 'supplier') {
      sendError(res, 'Only admin or supplier can receive RMA items', 403);
      return;
    }

    const { id } = req.params;

    const result = await receiveRMA({
      rmaId: id,
      receivedBy: currentUser.id,
      storeId,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to receive RMA items', 400);
      return;
    }

    sendSuccess(res, {
      rma: result.rma,
      message: 'RMA items received and refund processed',
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /rma/:id/status
 * Update RMA status (for pickup tracking)
 */
export const updateRMAStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    // Check permissions
    if (currentUser.role !== 'admin' && currentUser.role !== 'supplier') {
      sendError(res, 'Only admin or supplier can update RMA status', 403);
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pickup_scheduled', 'picked_up', 'refunded', 'closed'];
    if (!validStatuses.includes(status)) {
      sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const rma = await RMA.findOne({ _id: id, storeId: storeObjId });

    if (!rma) {
      sendError(res, 'RMA not found', 404);
      return;
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      approved: ['pickup_scheduled', 'picked_up'],
      pickup_scheduled: ['picked_up'],
      picked_up: ['received'],
      received: ['refunded'],
      refunded: ['closed'],
    };

    const allowedNextStatuses = validTransitions[rma.status] || [];
    if (!allowedNextStatuses.includes(status)) {
      sendError(res, `Invalid status transition from ${rma.status} to ${status}`, 400);
      return;
    }

    rma.status = status as any;
    if (status === 'refunded') {
      rma.refundedAt = new Date();
    }
    await rma.save();

    sendSuccess(res, {
      rma,
      message: 'RMA status updated',
    });
  } catch (error: any) {
    next(error);
  }
};

