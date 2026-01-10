import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import {
  createRMARequest,
  getRMARequest,
  listRMARequests,
} from '../services/unifiedRMARequest.service';
import { RMA } from '../models/RMA';
import { z } from 'zod';

/**
 * Unified RMA Request Controller
 * 
 * PURPOSE:
 * - Create RMA requests for Logistics, Returns, and CRM
 * - Get RMA requests by reference
 * - List RMA requests with filters
 */

const createRMARequestSchema = z.object({
  rmaType: z.enum(['logistics', 'returns', 'crm']),
  orderId: z.string().optional(),
  rmaId: z.string().optional(),
  crmTicketId: z.string().optional(),
  items: z.array(
    z.object({
      globalVariantId: z.string(),
      quantity: z.number().int().positive(),
      reason: z.string().min(1),
      condition: z.enum(['sealed', 'opened', 'damaged']),
    })
  ),
  refundMethod: z.enum(['original', 'wallet', 'cod_adjustment']),
  crmScenario: z.enum(['warranty', 'replacement', 'defective', 'wrong_item', 'other']).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  exchangeRequested: z.boolean().optional(),
  exchangeVariantId: z.string().optional(),
});

/**
 * POST /api/rma-requests
 * Create RMA request
 */
export const createRMARequestController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const validatedData = createRMARequestSchema.parse(req.body);
    const {
      rmaType,
      orderId,
      rmaId,
      crmTicketId,
      items,
      refundMethod,
      crmScenario,
      urgency,
      exchangeRequested,
      exchangeVariantId,
    } = validatedData;

    // Validate required fields based on RMA type
    if (rmaType === 'logistics' && !orderId) {
      sendError(res, 'orderId is required for logistics RMA', 400);
      return;
    }
    if (rmaType === 'returns' && !rmaId) {
      sendError(res, 'rmaId is required for returns RMA', 400);
      return;
    }
    if (rmaType === 'crm' && !crmTicketId) {
      sendError(res, 'crmTicketId is required for CRM RMA', 400);
      return;
    }

    const result = await createRMARequest({
      rmaType,
      orderId,
      rmaId: rmaId ? new mongoose.Types.ObjectId(rmaId) : undefined,
      crmTicketId,
      items: items.map((item) => ({
        globalVariantId: new mongoose.Types.ObjectId(item.globalVariantId),
        quantity: item.quantity,
        reason: item.reason,
        condition: item.condition,
      })),
      refundMethod,
      storeId: new mongoose.Types.ObjectId(storeId),
      customerId: currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : undefined,
      crmScenario: crmScenario as any,
      urgency: urgency as any,
      exchangeRequested,
      exchangeVariantId: exchangeVariantId ? new mongoose.Types.ObjectId(exchangeVariantId) : undefined,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'RMA request creation failed', 400);
      return;
    }

    sendSuccess(
      res,
      {
        rma: {
          id: result.rma!._id.toString(),
          rmaNumber: result.rma!.rmaNumber,
          rmaType: result.rma!.rmaType,
          status: result.rma!.status,
          refundAmount: result.rma!.refundAmount,
          items: result.rma!.items.map((item) => ({
            globalVariantId: item.globalVariantId.toString(),
            quantity: item.quantity,
            reason: item.reason,
            condition: item.condition,
          })),
        },
      },
      'RMA request created successfully'
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /api/rma-requests/:rmaType/:referenceId
 * Get RMA request by reference
 */
export const getRMARequestController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { rmaType, referenceId } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    if (!['logistics', 'returns', 'crm'].includes(rmaType)) {
      sendError(res, 'Invalid RMA type', 400);
      return;
    }

    const rma = await getRMARequest(
      rmaType as any,
      referenceId,
      new mongoose.Types.ObjectId(storeId)
    );

    if (!rma) {
      sendError(res, 'RMA request not found', 404);
      return;
    }

    // Check access
    if (currentUser.role === 'customer' && rma.customerId) {
      const customerId = typeof rma.customerId === 'string' ? new mongoose.Types.ObjectId(rma.customerId) : rma.customerId;
      const userId = currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : null;
      if (userId && customerId.toString() !== userId.toString()) {
        sendError(res, 'Access denied', 403);
        return;
      }
    }

    sendSuccess(
      res,
      {
        rma: {
          id: rma._id.toString(),
          rmaNumber: rma.rmaNumber,
          rmaType: rma.rmaType,
          status: rma.status,
          refundAmount: rma.refundAmount,
          refundMethod: rma.refundMethod,
          items: rma.items.map((item) => ({
            globalVariantId: item.globalVariantId.toString(),
            quantity: item.quantity,
            reason: item.reason,
            condition: item.condition,
            originalPrice: item.originalPrice,
            refundAmount: item.refundAmount,
          })),
          crmScenario: rma.crmScenario,
          urgency: rma.urgency,
          exchangeRequested: rma.exchangeRequested,
          createdAt: rma.createdAt,
        },
      },
      'RMA request retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/rma-requests
 * List RMA requests
 */
export const listRMARequestsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { rmaType, status, customerId, page = 1, limit = 50 } = req.query;

    // For customers, only show their own RMAs
    const resolvedCustomerId = currentUser.role === 'customer'
      ? (currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : undefined)
      : (customerId ? new mongoose.Types.ObjectId(customerId as string) : undefined);

    const result = await listRMARequests({
      storeId: new mongoose.Types.ObjectId(storeId),
      rmaType: rmaType as any,
      status: status as string,
      customerId: resolvedCustomerId,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    sendSuccess(
      res,
      {
        rmas: result.rmas.map((rma) => ({
          id: rma._id.toString(),
          rmaNumber: rma.rmaNumber,
          rmaType: rma.rmaType,
          status: rma.status,
          refundAmount: rma.refundAmount,
          refundMethod: rma.refundMethod,
          itemsCount: rma.items.length,
          createdAt: rma.createdAt,
        })),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit),
        },
      },
      'RMA requests retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

