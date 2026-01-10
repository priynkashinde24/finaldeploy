import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Courier, ICourier } from '../models/Courier';
import { CourierRule, ICourierRule } from '../models/CourierRule';
import { Order } from '../models/Order';
import { ShippingZone } from '../models/ShippingZone';
import { logAudit } from '../utils/auditLogger';
import { assignCourier } from '../utils/courierEngine';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Admin Courier Management Controller
 * 
 * PURPOSE:
 * - Manage couriers per store
 * - Manage courier mapping rules
 * - Allow manual courier reassignment
 * - Admin-only access
 */

const createCourierSchema = z.object({
  name: z.string().min(1, 'Courier name is required'),
  code: z.string().min(1, 'Courier code is required').transform((val) => val.toUpperCase()),
  supportsCOD: z.boolean().default(false),
  maxWeight: z.number().min(0, 'Max weight must be non-negative').default(0),
  serviceableZones: z.array(z.string()).min(1, 'At least one serviceable zone is required'),
  serviceablePincodes: z.array(z.string()).optional().default([]),
  priority: z.number().min(1, 'Priority must be at least 1').default(999),
  isActive: z.boolean().default(true),
});

const updateCourierSchema = createCourierSchema.partial();

const createCourierRuleSchemaBase = z.object({
  zoneId: z.string().min(1, 'Zone ID is required'),
  paymentMethod: z.enum(['prepaid', 'cod', 'both']),
  minWeight: z.number().min(0).optional().nullable(),
  maxWeight: z.number().min(0).optional().nullable(),
  minOrderValue: z.number().min(0).optional().nullable(),
  maxOrderValue: z.number().min(0).optional().nullable(),
  courierId: z.string().min(1, 'Courier ID is required'),
  priority: z.number().min(1, 'Priority must be at least 1').default(999),
  isActive: z.boolean().default(true),
});

const createCourierRuleSchema = createCourierRuleSchemaBase.refine((data) => {
  if (data.minWeight != null && data.maxWeight != null && data.maxWeight <= data.minWeight) {
    return false;
  }
  return true;
}, {
  message: 'Max weight must be greater than min weight',
  path: ['maxWeight'],
}).refine((data) => {
  if (data.minOrderValue != null && data.maxOrderValue != null && data.maxOrderValue <= data.minOrderValue) {
    return false;
  }
  return true;
}, {
  message: 'Max order value must be greater than min order value',
  path: ['maxOrderValue'],
});

const updateCourierRuleSchema = createCourierRuleSchemaBase.partial();

const assignCourierToOrderSchema = z.object({
  courierId: z.string().min(1, 'Courier ID is required'),
  reason: z.string().optional(),
});

/**
 * POST /admin/couriers
 * Create courier
 */
export const createCourier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createCourierSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Check for existing courier with same code
    const existingCourier = await Courier.findOne({
      storeId: storeObjId,
      code: validatedData.code,
    });

    if (existingCourier) {
      sendError(res, 'A courier with this code already exists', 400);
      return;
    }

    // Validate serviceable zones
    const zoneIds = validatedData.serviceableZones.map((id) => new mongoose.Types.ObjectId(id));
    const zones = await ShippingZone.find({
      _id: { $in: zoneIds },
      storeId: storeObjId,
    });

    if (zones.length !== zoneIds.length) {
      sendError(res, 'One or more serviceable zones not found', 400);
      return;
    }

    const courier = new Courier({
      storeId: storeObjId,
      name: validatedData.name,
      code: validatedData.code,
      supportsCOD: validatedData.supportsCOD,
      maxWeight: validatedData.maxWeight,
      serviceableZones: zoneIds,
      serviceablePincodes: validatedData.serviceablePincodes || [],
      priority: validatedData.priority,
      isActive: validatedData.isActive,
    });

    await courier.save();

    // Audit log
    await logAudit({
      req,
      action: 'COURIER_CREATED',
      entityType: 'Courier',
      entityId: courier._id.toString(),
      description: `Courier created: ${validatedData.name} (${validatedData.code})`,
      after: {
        name: validatedData.name,
        code: validatedData.code,
        supportsCOD: validatedData.supportsCOD,
        maxWeight: validatedData.maxWeight,
        zoneCount: zoneIds.length,
        priority: validatedData.priority,
      },
    });

    sendSuccess(res, { courier }, 'Courier created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/couriers
 * Get couriers
 */
export const getCouriers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (isActive !== undefined) query.isActive = isActive;

    const couriers = await Courier.find(query)
      .populate('serviceableZones', 'name countryCode')
      .sort({ priority: 1, name: 1 })
      .lean();

    sendSuccess(res, { couriers }, 'Couriers retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/couriers/:id
 * Update courier
 */
export const updateCourier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = updateCourierSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const courier = await Courier.findOne({
      _id: id,
      storeId: storeObjId,
    });

    if (!courier) {
      sendError(res, 'Courier not found', 404);
      return;
    }

    const before = {
      name: courier.name,
      code: courier.code,
      supportsCOD: courier.supportsCOD,
      maxWeight: courier.maxWeight,
      priority: courier.priority,
      isActive: courier.isActive,
    };

    // Update fields
    if (validatedData.name !== undefined) courier.name = validatedData.name;
    if (validatedData.code !== undefined) {
      // Check for duplicate code
      const existingCourier = await Courier.findOne({
        _id: { $ne: courier._id },
        storeId: storeObjId,
        code: validatedData.code,
      });
      if (existingCourier) {
        sendError(res, 'A courier with this code already exists', 400);
        return;
      }
      courier.code = validatedData.code;
    }
    if (validatedData.supportsCOD !== undefined) courier.supportsCOD = validatedData.supportsCOD;
    if (validatedData.maxWeight !== undefined) courier.maxWeight = validatedData.maxWeight;
    if (validatedData.serviceableZones !== undefined) {
      const zoneIds = validatedData.serviceableZones.map((id) => new mongoose.Types.ObjectId(id));
      const zones = await ShippingZone.find({
        _id: { $in: zoneIds },
        storeId: storeObjId,
      });
      if (zones.length !== zoneIds.length) {
        sendError(res, 'One or more serviceable zones not found', 400);
        return;
      }
      courier.serviceableZones = zoneIds;
    }
    if (validatedData.serviceablePincodes !== undefined) courier.serviceablePincodes = validatedData.serviceablePincodes;
    if (validatedData.priority !== undefined) courier.priority = validatedData.priority;
    if (validatedData.isActive !== undefined) courier.isActive = validatedData.isActive;

    await courier.save();

    // Audit log
    await logAudit({
      req,
      action: 'COURIER_UPDATED',
      entityType: 'Courier',
      entityId: courier._id.toString(),
      description: `Courier updated: ${courier.name} (${courier.code})`,
      before,
      after: {
        name: courier.name,
        code: courier.code,
        supportsCOD: courier.supportsCOD,
        maxWeight: courier.maxWeight,
        priority: courier.priority,
        isActive: courier.isActive,
      },
    });

    sendSuccess(res, { courier }, 'Courier updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * POST /admin/courier-rules
 * Create courier rule
 */
export const createCourierRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createCourierRuleSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const zoneObjId = new mongoose.Types.ObjectId(validatedData.zoneId);
    const courierObjId = new mongoose.Types.ObjectId(validatedData.courierId);

    // Verify zone exists
    const zone = await ShippingZone.findOne({
      _id: zoneObjId,
      storeId: storeObjId,
    });

    if (!zone) {
      sendError(res, 'Shipping zone not found', 404);
      return;
    }

    // Verify courier exists
    const courier = await Courier.findOne({
      _id: courierObjId,
      storeId: storeObjId,
    });

    if (!courier) {
      sendError(res, 'Courier not found', 404);
      return;
    }

    // Verify courier services this zone
    if (!courier.serviceableZones.some((z) => z.toString() === zoneObjId.toString())) {
      sendError(res, 'Courier does not service this zone', 400);
      return;
    }

    const rule = new CourierRule({
      storeId: storeObjId,
      zoneId: zoneObjId,
      paymentMethod: validatedData.paymentMethod,
      minWeight: validatedData.minWeight ?? null,
      maxWeight: validatedData.maxWeight ?? null,
      minOrderValue: validatedData.minOrderValue ?? null,
      maxOrderValue: validatedData.maxOrderValue ?? null,
      courierId: courierObjId,
      priority: validatedData.priority,
      isActive: validatedData.isActive,
    });

    await rule.save();

    // Audit log
    await logAudit({
      req,
      action: 'COURIER_RULE_CREATED',
      entityType: 'CourierRule',
      entityId: rule._id.toString(),
      description: `Courier rule created: ${courier.name} for zone ${zone.name}`,
      after: {
        zoneId: validatedData.zoneId,
        zoneName: zone.name,
        courierId: validatedData.courierId,
        courierName: courier.name,
        paymentMethod: validatedData.paymentMethod,
        priority: validatedData.priority,
      },
      metadata: {
        minWeight: validatedData.minWeight,
        maxWeight: validatedData.maxWeight,
        minOrderValue: validatedData.minOrderValue,
        maxOrderValue: validatedData.maxOrderValue,
      },
    });

    sendSuccess(res, { rule }, 'Courier rule created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/courier-rules
 * Get courier rules
 */
export const getCourierRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const zoneId = req.query.zoneId as string | undefined;
    const courierId = req.query.courierId as string | undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (zoneId) query.zoneId = new mongoose.Types.ObjectId(zoneId);
    if (courierId) query.courierId = new mongoose.Types.ObjectId(courierId);
    if (isActive !== undefined) query.isActive = isActive;

    const rules = await CourierRule.find(query)
      .populate('zoneId', 'name countryCode')
      .populate('courierId', 'name code')
      .sort({ zoneId: 1, priority: 1 })
      .lean();

    sendSuccess(res, { rules }, 'Courier rules retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/courier-rules/:id
 * Update courier rule
 */
export const updateCourierRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = updateCourierRuleSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const rule = await CourierRule.findOne({
      _id: id,
      storeId: storeObjId,
    }).populate('zoneId', 'name').populate('courierId', 'name');

    if (!rule) {
      sendError(res, 'Courier rule not found', 404);
      return;
    }

    const before = {
      paymentMethod: rule.paymentMethod,
      minWeight: rule.minWeight,
      maxWeight: rule.maxWeight,
      minOrderValue: rule.minOrderValue,
      maxOrderValue: rule.maxOrderValue,
      courierId: rule.courierId.toString(),
      priority: rule.priority,
      isActive: rule.isActive,
    };

    // Update fields
    if (validatedData.zoneId !== undefined) {
      const zoneObjId = new mongoose.Types.ObjectId(validatedData.zoneId);
      const zone = await ShippingZone.findOne({
        _id: zoneObjId,
        storeId: storeObjId,
      });
      if (!zone) {
        sendError(res, 'Shipping zone not found', 404);
        return;
      }
      rule.zoneId = zoneObjId;
    }
    if (validatedData.courierId !== undefined) {
      const courierObjId = new mongoose.Types.ObjectId(validatedData.courierId);
      const courier = await Courier.findOne({
        _id: courierObjId,
        storeId: storeObjId,
      });
      if (!courier) {
        sendError(res, 'Courier not found', 404);
        return;
      }
      rule.courierId = courierObjId;
    }
    if (validatedData.paymentMethod !== undefined) rule.paymentMethod = validatedData.paymentMethod;
    if (validatedData.minWeight !== undefined) rule.minWeight = validatedData.minWeight ?? undefined;
    if (validatedData.maxWeight !== undefined) rule.maxWeight = validatedData.maxWeight ?? undefined;
    if (validatedData.minOrderValue !== undefined) rule.minOrderValue = validatedData.minOrderValue ?? undefined;
    if (validatedData.maxOrderValue !== undefined) rule.maxOrderValue = validatedData.maxOrderValue ?? undefined;
    if (validatedData.priority !== undefined) rule.priority = validatedData.priority;
    if (validatedData.isActive !== undefined) rule.isActive = validatedData.isActive;

    await rule.save();

    // Audit log
    await logAudit({
      req,
      action: 'COURIER_RULE_UPDATED',
      entityType: 'CourierRule',
      entityId: rule._id.toString(),
      description: `Courier rule updated`,
      before,
      after: {
        paymentMethod: rule.paymentMethod,
        minWeight: rule.minWeight,
        maxWeight: rule.maxWeight,
        minOrderValue: rule.minOrderValue,
        maxOrderValue: rule.maxOrderValue,
        courierId: rule.courierId.toString(),
        priority: rule.priority,
        isActive: rule.isActive,
      },
    });

    sendSuccess(res, { rule }, 'Courier rule updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/orders/:id/assign-courier
 * Manually assign/reassign courier to order
 */
export const assignCourierToOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = assignCourierToOrderSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const courierObjId = new mongoose.Types.ObjectId(validatedData.courierId);

    // Find order
    const order = await Order.findOne({
      _id: id,
      storeId: storeObjId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Check if order can be reassigned (only before shipment)
    if (order.orderStatus === 'shipped' || order.orderStatus === 'out_for_delivery' || order.orderStatus === 'delivered') {
      sendError(res, 'Cannot reassign courier after order is shipped', 400);
      return;
    }

    // Verify courier exists and is active
    const courier = await Courier.findOne({
      _id: courierObjId,
      storeId: storeObjId,
      isActive: true,
    });

    if (!courier) {
      sendError(res, 'Courier not found or inactive', 404);
      return;
    }

    // Verify courier services the order's zone
    if (!order.shippingSnapshot) {
      sendError(res, 'Order does not have shipping zone assigned', 400);
      return;
    }

    const zoneId = order.shippingSnapshot.zoneId;
    if (!courier.serviceableZones.some((z) => z.toString() === zoneId.toString())) {
      sendError(res, 'Courier does not service this order\'s zone', 400);
      return;
    }

    // Verify COD support if needed
    if ((order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial') && !courier.supportsCOD) {
      sendError(res, 'Courier does not support COD', 400);
      return;
    }

    // Preserve old snapshot for audit
    const oldSnapshot = order.courierSnapshot ? { ...order.courierSnapshot } : null;

    // Update courier snapshot
    order.courierSnapshot = {
      courierId: courier._id,
      courierName: courier.name,
      courierCode: courier.code,
      ruleId: null, // Manual assignment has no rule
      assignedAt: new Date(),
      reason: validatedData.reason || `Manually assigned by admin`,
    };

    await order.save();

    // Audit log
    await logAudit({
      req,
      action: 'COURIER_REASSIGNED',
      entityType: 'Order',
      entityId: order._id.toString(),
      description: `Courier reassigned: ${courier.name} (${courier.code})`,
      before: oldSnapshot,
      after: {
        courierId: courier._id.toString(),
        courierName: courier.name,
        courierCode: courier.code,
        reason: order.courierSnapshot.reason,
      },
      metadata: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        previousCourier: oldSnapshot ? oldSnapshot.courierName : null,
      },
    });

    sendSuccess(res, { order }, 'Courier assigned successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

