import { Request, Response, NextFunction } from 'express';
import { RMA } from '../models/RMA';
import { Order } from '../models/Order';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { calculateReturnFee, addAuditLog, ReturnItem } from '../services/rmaService';
import { z } from 'zod';

// Validation schemas
const submitRMASchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        sku: z.string().min(1, 'SKU is required'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        reason: z.string().min(1, 'Reason is required'),
      })
    )
    .min(1, 'At least one item is required'),
  notes: z.array(z.string()).optional(),
});

const approveRMASchema = z.object({
  note: z.string().optional(),
});

const declineRMASchema = z.object({
  note: z.string().min(1, 'Note is required for declining RMA'),
});

/**
 * Submit RMA request
 * POST /api/rma/submit
 */
export const submitRMA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = submitRMASchema.parse(req.body);
    const { orderId, customerId, items, notes } = validatedData;

    // Find order
    const order = await Order.findOne({ orderId });
    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Calculate return fee
    const returnItems: ReturnItem[] = items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
    }));

    const feeCalculation = await calculateReturnFee(orderId, returnItems);

    // Generate RMA ID
    const rmaId = `RMA_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create RMA record
    const rma = new RMA({
      rmaId,
      orderId,
      storeId: order.storeId,
      customerId,
      items: items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
        reason: item.reason,
      })),
      requestedAt: new Date(),
      status: 'submitted',
      returnFee: feeCalculation.totalFee,
      notes: notes || [],
      auditLog: [],
    });

    // Add initial audit log
    addAuditLog(rma, 'RMA_SUBMITTED', 'submitted', 'RMA request submitted by customer', customerId);

    await rma.save();

    // Simulate admin notification (stub)
    console.log(`[NOTIFICATION] New RMA submitted: ${rmaId} for order ${orderId}`);

    sendSuccess(
      res,
      {
        rmaId,
        orderId,
        returnFee: feeCalculation.totalFee,
        itemFees: feeCalculation.itemFees,
        status: rma.status,
      },
      'RMA submitted successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get RMA by ID
 * GET /api/rma/:rmaId
 */
export const getRMAById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rmaId } = req.params;

    const rma = await RMA.findOne({ rmaId });

    if (!rma) {
      sendError(res, 'RMA not found', 404);
      return;
    }

    sendSuccess(res, rma, 'RMA retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Approve RMA
 * POST /api/rma/:rmaId/approve
 */
export const approveRMA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rmaId } = req.params;
    const validatedData = approveRMASchema.parse(req.body);
    const { note } = validatedData;

    const rma = await RMA.findOne({ rmaId });
    if (!rma) {
      sendError(res, 'RMA not found', 404);
      return;
    }

    if (rma.status !== 'requested') {
      sendError(res, `Cannot approve RMA with status: ${rma.status}`, 400);
      return;
    }

    // Update status
    const previousStatus = rma.status;
    rma.status = 'approved';
    if (note) {
      if (!rma.metadata) rma.metadata = {};
      if (!rma.metadata.notes) rma.metadata.notes = [];
      rma.metadata.notes.push({ note, timestamp: new Date(), type: 'approval' });
    }

    // Add audit log
    addAuditLog(
      rma,
      'RMA_APPROVED',
      'approved',
      note || 'RMA approved by admin',
      req.body.userId || 'admin' // In production, get from auth
    );

    await rma.save();

    // Simulate notification (stub)
    console.log(`[NOTIFICATION] RMA ${rmaId} approved`);

    sendSuccess(res, rma, 'RMA approved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Decline RMA
 * POST /api/rma/:rmaId/decline
 */
export const declineRMA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rmaId } = req.params;
    const validatedData = declineRMASchema.parse(req.body);
    const { note } = validatedData;

    const rma = await RMA.findOne({ rmaId });
    if (!rma) {
      sendError(res, 'RMA not found', 404);
      return;
    }

    if (rma.status !== 'requested') {
      sendError(res, `Cannot decline RMA with status: ${rma.status}`, 400);
      return;
    }

    // Update status
    rma.status = 'rejected';
    if (!rma.metadata) rma.metadata = {};
    if (!rma.metadata.notes) rma.metadata.notes = [];
    rma.metadata.notes.push({ note, timestamp: new Date(), type: 'rejection' });

    // Add audit log
    addAuditLog(
      rma,
      'RMA_DECLINED',
      'declined',
      note,
      req.body.userId || 'admin' // In production, get from auth
    );

    await rma.save();

    // Simulate notification (stub)
    console.log(`[NOTIFICATION] RMA ${rmaId} declined: ${note}`);

    sendSuccess(res, rma, 'RMA declined successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all RMAs (admin)
 * GET /api/rma
 */
export const getAllRMAs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, customerId, orderId, storeId } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (orderId) filter.orderId = orderId;
    if (storeId) filter.storeId = storeId;

    const rmas = await RMA.find(filter).sort({ createdAt: -1 }).limit(1000);

    sendSuccess(res, rmas, 'RMAs retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate return fee (preview before submission)
 * POST /api/rma/calculate-fee
 */
export const calculateFee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId, items } = req.body;

    if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
      sendError(res, 'Order ID and items are required', 400);
      return;
    }

    const returnItems: ReturnItem[] = items.map((item: any) => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
    }));

    const feeCalculation = await calculateReturnFee(orderId, returnItems);

    sendSuccess(res, feeCalculation, 'Return fee calculated successfully');
  } catch (error) {
    next(error);
  }
};

