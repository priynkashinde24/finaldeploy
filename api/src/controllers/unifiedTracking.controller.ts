import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import {
  getLogisticsTracking,
  getReturnsTracking,
  getCRMTracking,
  createTrackingEvent,
} from '../services/unifiedTracking.service';
import { ViewerContext } from '../services/orderTracking.service';
import { TrackingEvent } from '../models/TrackingEvent';
import { z } from 'zod';

/**
 * Unified Tracking Controller
 * 
 * PURPOSE:
 * - Provide tracking endpoints for Logistics, Returns, and CRM
 * - Handle authentication and authorization
 * - Support public tracking with verification
 */

const createEventSchema = z.object({
  trackingType: z.enum(['logistics', 'returns', 'crm']),
  orderId: z.string().optional(),
  rmaId: z.string().optional(),
  crmTicketId: z.string().optional(),
  status: z.string().min(1),
  location: z.string().optional(),
  description: z.string().min(1),
  courierId: z.string().optional(),
  awbNumber: z.string().optional(),
  source: z.enum(['system', 'courier_api', 'manual', 'webhook']).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/tracking/logistics/:orderNumber
 * Track logistics (order)
 */
export const trackLogistics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderNumber } = req.params;
    const { email, phone } = req.query;

    const viewerContext = buildViewerContext(req, email as string, phone as string);

    const result = await getLogisticsTracking(orderNumber, viewerContext);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 :
                        result.error?.includes('Access denied') ? 403 : 400;
      sendError(res, result.error || 'Failed to fetch tracking', statusCode);
      return;
    }

    sendSuccess(res, result.data, 'Tracking data retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/tracking/returns/:rmaNumber
 * Track returns (RMA)
 */
export const trackReturns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rmaNumber } = req.params;
    const { email, phone } = req.query;

    const viewerContext = buildViewerContext(req, email as string, phone as string);

    const result = await getReturnsTracking(rmaNumber, viewerContext);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 :
                        result.error?.includes('Access denied') ? 403 : 400;
      sendError(res, result.error || 'Failed to fetch tracking', statusCode);
      return;
    }

    sendSuccess(res, result.data, 'Tracking data retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/tracking/crm/:ticketId
 * Track CRM (customer service)
 */
export const trackCRM = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const { email, phone } = req.query;

    const viewerContext = buildViewerContext(req, email as string, phone as string);

    const result = await getCRMTracking(ticketId, viewerContext);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 :
                        result.error?.includes('Access denied') ? 403 : 400;
      sendError(res, result.error || 'Failed to fetch tracking', statusCode);
      return;
    }

    sendSuccess(res, result.data, 'Tracking data retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/tracking/events
 * Create tracking event (admin/system only)
 */
export const createEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    // Only admin and system can create events
    if (currentUser.role !== 'admin' && currentUser.role !== 'system') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createEventSchema.parse(req.body);
    const {
      trackingType,
      orderId,
      rmaId,
      crmTicketId,
      status,
      location,
      description,
      courierId,
      awbNumber,
      source = 'manual',
      metadata,
    } = validatedData;

    // Validate that at least one reference ID is provided
    if (!orderId && !rmaId && !crmTicketId) {
      sendError(res, 'orderId, rmaId, or crmTicketId is required', 400);
      return;
    }

    const event = await createTrackingEvent({
      trackingType,
      orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
      rmaId: rmaId ? new mongoose.Types.ObjectId(rmaId) : undefined,
      crmTicketId,
      storeId: new mongoose.Types.ObjectId(storeId),
      status,
      location,
      description,
      courierId: courierId ? new mongoose.Types.ObjectId(courierId) : undefined,
      awbNumber,
      source: source as any,
      metadata,
    });

    sendSuccess(
      res,
      {
        event: {
          id: event._id.toString(),
          trackingType: event.trackingType,
          status: event.status,
          description: event.description,
          location: event.location,
          timestamp: event.timestamp,
        },
      },
      'Tracking event created'
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
 * GET /api/tracking/events
 * List tracking events with filters
 */
export const listEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { trackingType, orderId, rmaId, crmTicketId, status, limit = 50, page = 1 } = req.query;

    const filter: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (trackingType) {
      filter.trackingType = trackingType;
    }
    if (orderId) {
      filter.orderId = new mongoose.Types.ObjectId(orderId as string);
    }
    if (rmaId) {
      filter.rmaId = new mongoose.Types.ObjectId(rmaId as string);
    }
    if (crmTicketId) {
      filter.crmTicketId = crmTicketId;
    }
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const events = await TrackingEvent.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    const total = await TrackingEvent.countDocuments(filter);

    sendSuccess(
      res,
      {
        events: events.map((event) => ({
          id: event._id.toString(),
          trackingType: event.trackingType,
          status: event.status,
          description: event.description,
          location: event.location,
          timestamp: event.timestamp,
          source: event.source,
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Tracking events retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * Build viewer context from request
 */
function buildViewerContext(req: Request, email?: string, phone?: string): ViewerContext {
  const currentUser = req.user;
  const storeId = req.store?.storeId;

  if (currentUser) {
    const userRole = currentUser.role;
    if (userRole === 'admin') {
      return {
        type: 'admin',
        userId: currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : undefined,
        storeId: storeId ? new mongoose.Types.ObjectId(storeId) : undefined,
      };
    } else if (userRole === 'reseller') {
      return {
        type: 'reseller',
        userId: currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : undefined,
        storeId: storeId ? new mongoose.Types.ObjectId(storeId) : undefined,
      };
    } else {
      return {
        type: 'customer',
        userId: currentUser.id ? new mongoose.Types.ObjectId(currentUser.id) : undefined,
        storeId: storeId ? new mongoose.Types.ObjectId(storeId) : undefined,
      };
    }
  } else {
    // Public tracking
    return {
      type: 'public',
      email,
      phone,
    };
  }
}

