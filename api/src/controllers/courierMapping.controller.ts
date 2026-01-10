import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import {
  mapCourierForLogistics,
  mapCourierForReturns,
  mapCourierForCRM,
  getAvailableCouriersForScenario,
} from '../services/courierMapping.service';
import { CourierMapping, ICourierMapping } from '../models/CourierMapping';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Courier Mapping Controller
 * 
 * PURPOSE:
 * - Map couriers for different scenarios
 * - Manage courier mapping rules
 * - Provide courier selection APIs
 */

const createMappingSchema = z.object({
  mappingType: z.enum(['logistics', 'returns', 'crm']),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  courierId: z.string(),
  fallbackCourierId: z.string().optional(),
  // Logistics
  shippingZoneId: z.string().optional(),
  paymentMethod: z.enum(['prepaid', 'cod', 'both']).optional(),
  minWeight: z.number().min(0).optional(),
  maxWeight: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional(),
  maxOrderValue: z.number().min(0).optional(),
  // Returns
  returnReason: z.array(z.string()).optional(),
  itemCondition: z.enum(['sealed', 'opened', 'damaged', 'all']).optional(),
  returnValue: z.number().min(0).optional(),
  supportsPickup: z.boolean().optional(),
  // CRM
  crmScenario: z.enum(['support_ticket', 'document_delivery', 'replacement', 'warranty', 'all']).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  customerTier: z.enum(['standard', 'premium', 'vip', 'all']).optional(),
  // Priority
  priority: z.number().min(1).optional(),
  selectionPriority: z.enum(['cost', 'speed', 'reliability', 'coverage', 'custom']).optional(),
  customScore: z.number().optional(),
  // Conditions
  conditions: z.object({
    timeOfDay: z.array(z.string()).optional(),
    dayOfWeek: z.array(z.string()).optional(),
    season: z.array(z.string()).optional(),
    specialEvent: z.boolean().optional(),
  }).optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST /api/admin/courier-mapping/logistics
 * Map courier for logistics (outbound shipping)
 */
export const mapLogisticsCourier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const {
      shippingZoneId,
      orderWeight,
      orderValue,
      paymentMethod = 'prepaid',
      shippingPincode,
      priority = 'cost',
    } = req.body;

    if (!shippingZoneId || orderWeight === undefined || orderValue === undefined) {
      sendError(res, 'shippingZoneId, orderWeight, and orderValue are required', 400);
      return;
    }

    const result = await mapCourierForLogistics({
      storeId,
      shippingZoneId,
      orderWeight: parseFloat(orderWeight),
      orderValue: parseFloat(orderValue),
      paymentMethod: paymentMethod as 'prepaid' | 'cod' | 'both',
      shippingPincode,
      priority: priority as any,
    });

    await logAudit({
      req,
      action: 'COURIER_MAPPED_LOGISTICS',
      entityType: 'CourierMapping',
      entityId: result.mappingId.toString(),
      description: `Courier mapped for logistics: ${result.courier.name}`,
      metadata: {
        courierId: result.courier._id.toString(),
        mappingType: 'logistics',
        reason: result.reason,
      },
    });

    sendSuccess(res, {
      courier: {
        id: result.courier._id.toString(),
        name: result.courier.name,
        code: result.courier.code,
        supportsCOD: result.courier.supportsCOD,
      },
      mappingId: result.mappingId.toString(),
      reason: result.reason,
      score: result.score,
      fallbackCourier: result.fallbackCourier ? {
        id: result.fallbackCourier._id.toString(),
        name: result.fallbackCourier.name,
        code: result.fallbackCourier.code,
      } : null,
    }, 'Courier mapped for logistics');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/admin/courier-mapping/returns
 * Map courier for returns (reverse logistics)
 */
export const mapReturnsCourier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const {
      rmaId,
      returnReason,
      itemCondition,
      returnValue,
      originZoneId,
      customerZoneId,
      requiresPickup = true,
      priority = 'cost',
    } = req.body;

    const result = await mapCourierForReturns({
      storeId,
      rmaId: rmaId ? new mongoose.Types.ObjectId(rmaId) : undefined,
      returnReason,
      itemCondition: itemCondition as any,
      returnValue: returnValue ? parseFloat(returnValue) : undefined,
      originZoneId: originZoneId ? new mongoose.Types.ObjectId(originZoneId) : undefined,
      customerZoneId: customerZoneId ? new mongoose.Types.ObjectId(customerZoneId) : undefined,
      requiresPickup: requiresPickup === true || requiresPickup === 'true',
      priority: priority as any,
    });

    await logAudit({
      req,
      action: 'COURIER_MAPPED_RETURNS',
      entityType: 'CourierMapping',
      entityId: result.mappingId.toString(),
      description: `Courier mapped for returns: ${result.courier.name}`,
      metadata: {
        courierId: result.courier._id.toString(),
        mappingType: 'returns',
        rmaId,
        reason: result.reason,
      },
    });

    sendSuccess(res, {
      courier: {
        id: result.courier._id.toString(),
        name: result.courier.name,
        code: result.courier.code,
        supportsCOD: result.courier.supportsCOD,
      },
      mappingId: result.mappingId.toString(),
      reason: result.reason,
      score: result.score,
      fallbackCourier: result.fallbackCourier ? {
        id: result.fallbackCourier._id.toString(),
        name: result.fallbackCourier.name,
        code: result.fallbackCourier.code,
      } : null,
    }, 'Courier mapped for returns');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/admin/courier-mapping/crm
 * Map courier for CRM scenarios
 */
export const mapCRMCourier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const {
      scenario,
      urgency = 'medium',
      customerTier = 'standard',
      destinationZoneId,
      weight = 0,
      value = 0,
      priority = 'speed',
    } = req.body;

    if (!scenario) {
      sendError(res, 'scenario is required', 400);
      return;
    }

    const result = await mapCourierForCRM({
      storeId,
      scenario: scenario as any,
      urgency: urgency as any,
      customerTier: customerTier as any,
      destinationZoneId: destinationZoneId ? new mongoose.Types.ObjectId(destinationZoneId) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      value: value ? parseFloat(value) : undefined,
      priority: priority as any,
    });

    await logAudit({
      req,
      action: 'COURIER_MAPPED_CRM',
      entityType: 'CourierMapping',
      entityId: result.mappingId.toString(),
      description: `Courier mapped for CRM: ${result.courier.name}`,
      metadata: {
        courierId: result.courier._id.toString(),
        mappingType: 'crm',
        scenario,
        urgency,
        reason: result.reason,
      },
    });

    sendSuccess(res, {
      courier: {
        id: result.courier._id.toString(),
        name: result.courier.name,
        code: result.courier.code,
        supportsCOD: result.courier.supportsCOD,
      },
      mappingId: result.mappingId.toString(),
      reason: result.reason,
      score: result.score,
      fallbackCourier: result.fallbackCourier ? {
        id: result.fallbackCourier._id.toString(),
        name: result.fallbackCourier.name,
        code: result.fallbackCourier.code,
      } : null,
    }, 'Courier mapped for CRM');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/admin/courier-mapping/rules
 * Create courier mapping rule
 */
export const createMappingRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createMappingSchema.parse(req.body);

    const mapping = new CourierMapping({
      storeId,
      mappingType: validatedData.mappingType,
      name: validatedData.name,
      description: validatedData.description,
      courierId: new mongoose.Types.ObjectId(validatedData.courierId),
      fallbackCourierId: validatedData.fallbackCourierId
        ? new mongoose.Types.ObjectId(validatedData.fallbackCourierId)
        : null,
      shippingZoneId: validatedData.shippingZoneId
        ? new mongoose.Types.ObjectId(validatedData.shippingZoneId)
        : null,
      paymentMethod: validatedData.paymentMethod,
      minWeight: validatedData.minWeight,
      maxWeight: validatedData.maxWeight,
      minOrderValue: validatedData.minOrderValue,
      maxOrderValue: validatedData.maxOrderValue,
      returnReason: validatedData.returnReason,
      itemCondition: validatedData.itemCondition,
      returnValue: validatedData.returnValue,
      supportsPickup: validatedData.supportsPickup,
      crmScenario: validatedData.crmScenario,
      urgency: validatedData.urgency,
      customerTier: validatedData.customerTier,
      priority: validatedData.priority || 999,
      selectionPriority: validatedData.selectionPriority || 'cost',
      customScore: validatedData.customScore,
      conditions: validatedData.conditions,
      isActive: validatedData.isActive !== undefined ? validatedData.isActive : true,
    });

    await mapping.save();

    await logAudit({
      req,
      action: 'COURIER_MAPPING_RULE_CREATED',
      entityType: 'CourierMapping',
      entityId: mapping._id.toString(),
      description: `Courier mapping rule created: ${mapping.name}`,
      metadata: {
        mappingType: mapping.mappingType,
        courierId: mapping.courierId.toString(),
      },
    });

    sendSuccess(res, {
      mapping: {
        id: mapping._id.toString(),
        name: mapping.name,
        mappingType: mapping.mappingType,
        courierId: mapping.courierId.toString(),
        priority: mapping.priority,
        isActive: mapping.isActive,
      },
    }, 'Mapping rule created');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /api/admin/courier-mapping/rules
 * List courier mapping rules
 */
export const listMappingRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { mappingType, isActive, limit = 50, page = 1 } = req.query;

    const filter: any = { storeId };
    if (mappingType) {
      filter.mappingType = mappingType;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const mappings = await CourierMapping.find(filter)
      .populate('courierId', 'name code')
      .populate('fallbackCourierId', 'name code')
      .sort({ mappingType: 1, priority: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    const total = await CourierMapping.countDocuments(filter);

    sendSuccess(
      res,
      {
        mappings: mappings.map((m) => ({
          id: m._id.toString(),
          name: m.name,
          mappingType: m.mappingType,
          courier: m.courierId ? {
            id: (m.courierId as any)._id.toString(),
            name: (m.courierId as any).name,
            code: (m.courierId as any).code,
          } : null,
          priority: m.priority,
          isActive: m.isActive,
          createdAt: m.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Mapping rules retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/admin/courier-mapping/available
 * Get available couriers for a scenario
 */
export const getAvailableCouriers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { mappingType, zoneId, paymentMethod, weight, requiresPickup } = req.query;

    if (!mappingType) {
      sendError(res, 'mappingType is required', 400);
      return;
    }

    const couriers = await getAvailableCouriersForScenario(
      storeId,
      mappingType as any,
      {
        zoneId: zoneId ? new mongoose.Types.ObjectId(zoneId as string) : undefined,
        paymentMethod: paymentMethod as any,
        weight: weight ? parseFloat(weight as string) : undefined,
        requiresPickup: requiresPickup === 'true',
      }
    );

    sendSuccess(
      res,
      {
        couriers: couriers.map((c) => ({
          id: c._id.toString(),
          name: c.name,
          code: c.code,
          supportsCOD: c.supportsCOD,
          maxWeight: c.maxWeight,
          priority: c.priority,
        })),
      },
      'Available couriers retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

