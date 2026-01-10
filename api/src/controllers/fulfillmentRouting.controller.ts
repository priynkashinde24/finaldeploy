import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import {
  routeFulfillment,
  getFulfillmentRoute,
  confirmFulfillmentRoute,
} from '../services/unifiedFulfillmentRouting.service';
import { FulfillmentRoute } from '../models/FulfillmentRoute';
import { z } from 'zod';

/**
 * Fulfillment Routing Controller
 * 
 * PURPOSE:
 * - Route fulfillment for Logistics, Returns, and CRM
 * - Get routing decisions
 * - Confirm routing decisions
 */

const routeFulfillmentSchema = z.object({
  routeType: z.enum(['logistics', 'returns', 'crm']),
  items: z.array(z.object({
    globalVariantId: z.string(),
    quantity: z.number().min(1),
    supplierId: z.string().optional(),
  })),
  deliveryAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
  orderId: z.string().optional(),
  rmaId: z.string().optional(),
  crmTicketId: z.string().optional(),
  routingStrategy: z.enum(['cost', 'speed', 'distance', 'priority', 'balanced']).optional(),
  paymentMethod: z.string().optional(),
  orderValue: z.number().optional(),
  originZoneId: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

/**
 * POST /api/fulfillment-routing/route
 * Route fulfillment
 */
export const routeFulfillmentController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const validatedData = routeFulfillmentSchema.parse(req.body);
    const {
      routeType,
      items,
      deliveryAddress,
      orderId,
      rmaId,
      crmTicketId,
      routingStrategy,
      paymentMethod,
      orderValue,
      originZoneId,
      urgency,
    } = validatedData;

    // Validate required fields based on route type
    if (routeType === 'logistics' && !orderId) {
      sendError(res, 'orderId is required for logistics routing', 400);
      return;
    }
    if (routeType === 'returns' && !rmaId) {
      sendError(res, 'rmaId is required for returns routing', 400);
      return;
    }
    if (routeType === 'crm' && !crmTicketId) {
      sendError(res, 'crmTicketId is required for CRM routing', 400);
      return;
    }

    const result = await routeFulfillment({
      routeType,
      items: items.map((item) => ({
        globalVariantId: new mongoose.Types.ObjectId(item.globalVariantId),
        quantity: item.quantity,
        supplierId: item.supplierId ? new mongoose.Types.ObjectId(item.supplierId) : undefined,
      })),
      deliveryAddress,
      storeId: new mongoose.Types.ObjectId(storeId),
      orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
      rmaId: rmaId ? new mongoose.Types.ObjectId(rmaId) : undefined,
      crmTicketId,
      routingStrategy: routingStrategy as any,
      paymentMethod,
      orderValue,
      originZoneId: originZoneId ? new mongoose.Types.ObjectId(originZoneId) : undefined,
      urgency: urgency as any,
    });

    if (!result.success) {
      sendError(res, result.error || 'Fulfillment routing failed', 400);
      return;
    }

    sendSuccess(
      res,
      {
        route: {
          id: result.route!._id.toString(),
          routeType: result.route!.routeType,
          items: result.route!.items.map((item) => ({
            globalVariantId: item.globalVariantId.toString(),
            quantity: item.quantity,
            originId: item.originId.toString(),
            originName: item.originName,
            routingScore: item.routingScore,
            shippingCost: item.shippingCost,
          })),
          shipmentGroups: result.route!.shipmentGroups.map((group) => ({
            originId: group.originId.toString(),
            originName: group.originName,
            items: group.items,
            shippingCost: group.shippingCost,
            status: group.status,
          })),
          totalShippingCost: result.route!.totalShippingCost,
          routingStrategy: result.route!.routingStrategy,
          routingScore: result.route!.routingScore,
          status: result.route!.status,
        },
      },
      'Fulfillment routed successfully'
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
 * GET /api/fulfillment-routing/:routeType/:referenceId
 * Get fulfillment route
 */
export const getFulfillmentRouteController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { routeType, referenceId } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    if (!['logistics', 'returns', 'crm'].includes(routeType)) {
      sendError(res, 'Invalid route type', 400);
      return;
    }

    const route = await getFulfillmentRoute(
      routeType as any,
      referenceId,
      new mongoose.Types.ObjectId(storeId)
    );

    if (!route) {
      sendError(res, 'Fulfillment route not found', 404);
      return;
    }

    sendSuccess(
      res,
      {
        route: {
          id: route._id.toString(),
          routeType: route.routeType,
          items: route.items.map((item) => ({
            globalVariantId: item.globalVariantId.toString(),
            quantity: item.quantity,
            originId: item.originId.toString(),
            originName: item.originName,
            routingScore: item.routingScore,
            shippingCost: item.shippingCost,
          })),
          shipmentGroups: route.shipmentGroups.map((group) => ({
            originId: group.originId.toString(),
            originName: group.originName,
            items: group.items,
            shippingCost: group.shippingCost,
            status: group.status,
          })),
          totalShippingCost: route.totalShippingCost,
          routingStrategy: route.routingStrategy,
          routingScore: route.routingScore,
          status: route.status,
        },
      },
      'Fulfillment route retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/fulfillment-routing/:routeId/confirm
 * Confirm fulfillment route
 */
export const confirmFulfillmentRouteController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { routeId } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const result = await confirmFulfillmentRoute(
      routeId,
      new mongoose.Types.ObjectId(storeId)
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to confirm route', 400);
      return;
    }

    sendSuccess(
      res,
      {
        route: {
          id: result.route!._id.toString(),
          status: result.route!.status,
          confirmedAt: result.route!.confirmedAt,
        },
      },
      'Fulfillment route confirmed'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/fulfillment-routing/routes
 * List fulfillment routes
 */
export const listFulfillmentRoutesController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { routeType, status, limit = 50, page = 1 } = req.query;

    const filter: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (routeType) {
      filter.routeType = routeType;
    }

    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const routes = await FulfillmentRoute.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    const total = await FulfillmentRoute.countDocuments(filter);

    sendSuccess(
      res,
      {
        routes: routes.map((route) => ({
          id: route._id.toString(),
          routeType: route.routeType,
          shipmentGroups: route.shipmentGroups.length,
          totalShippingCost: route.totalShippingCost,
          routingStrategy: route.routingStrategy,
          status: route.status,
          createdAt: route.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Fulfillment routes retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

