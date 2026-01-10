import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { generateLabel, getLabel } from '../services/labelGenerator.service';
import { ShippingLabel } from '../models/ShippingLabel';
import { z } from 'zod';

/**
 * Label Generator Controller
 * 
 * PURPOSE:
 * - Generate labels for Logistics, Returns, and CRM
 * - Retrieve labels by reference
 * - List labels with filters
 */

const generateLabelSchema = z.object({
  labelType: z.enum(['logistics', 'returns', 'crm']),
  orderId: z.string().optional(),
  rmaId: z.string().optional(),
  crmTicketId: z.string().optional(),
  scenario: z.enum(['support_ticket', 'document_delivery', 'replacement', 'warranty']).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  customerTier: z.enum(['standard', 'premium', 'vip']).optional(),
  courierId: z.string().optional(),
});

/**
 * POST /api/labels/generate
 * Generate shipping label
 */
export const generateLabelController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const validatedData = generateLabelSchema.parse(req.body);
    const { labelType, orderId, rmaId, crmTicketId, scenario, urgency, customerTier, courierId } = validatedData;

    // Validate required fields based on label type
    if (labelType === 'logistics' && !orderId) {
      sendError(res, 'orderId is required for logistics labels', 400);
      return;
    }
    if (labelType === 'returns' && !rmaId) {
      sendError(res, 'rmaId is required for returns labels', 400);
      return;
    }
    if (labelType === 'crm' && (!crmTicketId || !scenario)) {
      sendError(res, 'crmTicketId and scenario are required for CRM labels', 400);
      return;
    }

    const result = await generateLabel({
      labelType,
      orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
      rmaId: rmaId ? new mongoose.Types.ObjectId(rmaId) : undefined,
      crmTicketId,
      scenario: scenario as any,
      urgency: urgency as any,
      customerTier: customerTier as any,
      storeId: new mongoose.Types.ObjectId(storeId),
      generatedBy: currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : new mongoose.Types.ObjectId(),
      courierId: courierId ? new mongoose.Types.ObjectId(courierId) : undefined,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Label generation failed', 400);
      return;
    }

    sendSuccess(
      res,
      {
        label: {
          id: result.label!._id.toString(),
          labelNumber: result.label!.labelNumber,
          labelType: result.label!.labelType,
          pdfUrl: result.label!.pdfUrl,
          courierName: result.label!.courierName,
          courierCode: result.label!.courierCode,
          status: result.label!.status,
          generatedAt: result.label!.generatedAt,
        },
      },
      'Label generated successfully'
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
 * GET /api/labels/:labelType/:referenceId
 * Get label by reference
 */
export const getLabelController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { labelType, referenceId } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    if (!['logistics', 'returns', 'crm'].includes(labelType)) {
      sendError(res, 'Invalid label type', 400);
      return;
    }

    const label = await getLabel(
      labelType as any,
      referenceId,
      new mongoose.Types.ObjectId(storeId)
    );

    if (!label) {
      sendError(res, 'Label not found', 404);
      return;
    }

    sendSuccess(
      res,
      {
        label: {
          id: label._id.toString(),
          labelNumber: label.labelNumber,
          labelType: label.labelType,
          pdfUrl: label.pdfUrl,
          courierName: label.courierName,
          courierCode: label.courierCode,
          status: label.status,
          generatedAt: label.generatedAt,
          orderDetails: label.orderDetails,
          returnDetails: label.returnDetails,
          crmDetails: label.crmDetails,
        },
      },
      'Label retrieved successfully'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/labels
 * List labels with filters
 */
export const listLabelsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { labelType, status, limit = 50, page = 1 } = req.query;

    const filter: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (labelType) {
      filter.labelType = labelType;
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = 'generated'; // Default to active labels
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const labels = await ShippingLabel.find(filter)
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    const total = await ShippingLabel.countDocuments(filter);

    sendSuccess(
      res,
      {
        labels: labels.map((label) => ({
          id: label._id.toString(),
          labelNumber: label.labelNumber,
          labelType: label.labelType,
          pdfUrl: label.pdfUrl,
          courierName: label.courierName,
          courierCode: label.courierCode,
          status: label.status,
          generatedAt: label.generatedAt,
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Labels retrieved successfully'
    );
  } catch (error: any) {
    next(error);
  }
};

