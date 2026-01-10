import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { ShippingZone, IShippingZone } from '../models/ShippingZone';
import { ShippingRate, IShippingRate } from '../models/ShippingRate';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Admin Shipping Management Controller
 * 
 * PURPOSE:
 * - Manage shipping zones per store
 * - Manage shipping rate slabs per zone
 * - Admin-only access
 */

const createShippingZoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required'),
  countryCode: z.string().length(2).transform((val) => val.toUpperCase()),
  stateCodes: z.array(z.string()).optional().default([]),
  pincodes: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true),
});

const updateShippingZoneSchema = createShippingZoneSchema.partial();

const createShippingRateSchemaBase = z.object({
  zoneId: z.string().min(1, 'Zone ID is required'),
  rateType: z.enum(['weight', 'order_value']),
  minValue: z.number().min(0, 'Minimum value must be non-negative'),
  maxValue: z.number().min(0, 'Maximum value must be non-negative'),
  baseRate: z.number().min(0, 'Base rate must be non-negative'),
  perUnitRate: z.number().min(0, 'Per unit rate must be non-negative').default(0),
  codSurcharge: z.number().min(0, 'COD surcharge must be non-negative').default(0),
  isActive: z.boolean().default(true),
});

const createShippingRateSchema = createShippingRateSchemaBase.refine((data) => data.maxValue > data.minValue, {
  message: 'Maximum value must be greater than minimum value',
  path: ['maxValue'],
});

const updateShippingRateSchema = createShippingRateSchemaBase.partial();

/**
 * POST /admin/shipping/zones
 * Create shipping zone
 */
export const createShippingZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createShippingZoneSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Check for existing zone with same name
    const existingZone = await ShippingZone.findOne({
      storeId: storeObjId,
      name: validatedData.name,
    });

    if (existingZone) {
      sendError(res, 'A zone with this name already exists', 400);
      return;
    }

    const zone = new ShippingZone({
      storeId: storeObjId,
      name: validatedData.name,
      countryCode: validatedData.countryCode,
      stateCodes: validatedData.stateCodes || [],
      pincodes: validatedData.pincodes || [],
      isActive: validatedData.isActive,
    });

    await zone.save();

    // Audit log
    await logAudit({
      req,
      action: 'SHIPPING_ZONE_CREATED',
      entityType: 'ShippingZone',
      entityId: zone._id.toString(),
      description: `Shipping zone created: ${validatedData.name} for ${validatedData.countryCode}`,
      after: {
        name: validatedData.name,
        countryCode: validatedData.countryCode,
        stateCodes: validatedData.stateCodes,
        pincodeCount: validatedData.pincodes?.length || 0,
      },
    });

    sendSuccess(res, { zone }, 'Shipping zone created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/shipping/zones
 * Get shipping zones
 */
export const getShippingZones = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const countryCode = req.query.countryCode as string | undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (countryCode) query.countryCode = countryCode.toUpperCase();
    if (isActive !== undefined) query.isActive = isActive;

    const zones = await ShippingZone.find(query)
      .sort({ countryCode: 1, name: 1 })
      .lean();

    sendSuccess(res, { zones }, 'Shipping zones retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/shipping/zones/:id
 * Update shipping zone
 */
export const updateShippingZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = updateShippingZoneSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const zone = await ShippingZone.findOne({
      _id: id,
      storeId: storeObjId,
    });

    if (!zone) {
      sendError(res, 'Shipping zone not found', 404);
      return;
    }

    const before = {
      name: zone.name,
      countryCode: zone.countryCode,
      stateCodes: zone.stateCodes,
      pincodes: zone.pincodes,
      isActive: zone.isActive,
    };

    // Update fields
    if (validatedData.name !== undefined) {
      // Check for duplicate name
      const existingZone = await ShippingZone.findOne({
        _id: { $ne: zone._id },
        storeId: storeObjId,
        name: validatedData.name,
      });
      if (existingZone) {
        sendError(res, 'A zone with this name already exists', 400);
        return;
      }
      zone.name = validatedData.name;
    }
    if (validatedData.countryCode !== undefined) zone.countryCode = validatedData.countryCode;
    if (validatedData.stateCodes !== undefined) zone.stateCodes = validatedData.stateCodes;
    if (validatedData.pincodes !== undefined) zone.pincodes = validatedData.pincodes;
    if (validatedData.isActive !== undefined) zone.isActive = validatedData.isActive;

    await zone.save();

    // Audit log
    await logAudit({
      req,
      action: 'SHIPPING_ZONE_UPDATED',
      entityType: 'ShippingZone',
      entityId: zone._id.toString(),
      description: `Shipping zone updated: ${zone.name}`,
      before,
      after: {
        name: zone.name,
        countryCode: zone.countryCode,
        stateCodes: zone.stateCodes,
        pincodeCount: zone.pincodes?.length || 0,
        isActive: zone.isActive,
      },
    });

    sendSuccess(res, { zone }, 'Shipping zone updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * POST /admin/shipping/rates
 * Create shipping rate
 */
export const createShippingRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createShippingRateSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const zoneObjId = new mongoose.Types.ObjectId(validatedData.zoneId);

    // Verify zone exists and belongs to store
    const zone = await ShippingZone.findOne({
      _id: zoneObjId,
      storeId: storeObjId,
    });

    if (!zone) {
      sendError(res, 'Shipping zone not found', 404);
      return;
    }

    // Check for overlapping slabs (handled by model validation, but check here for better error)
    const overlappingRate = await ShippingRate.findOne({
      storeId: storeObjId,
      zoneId: zoneObjId,
      rateType: validatedData.rateType,
      isActive: true,
      $or: [
        { minValue: { $lte: validatedData.minValue }, maxValue: { $gt: validatedData.minValue } },
        { minValue: { $lt: validatedData.maxValue }, maxValue: { $gte: validatedData.maxValue } },
        { minValue: { $gte: validatedData.minValue }, maxValue: { $lte: validatedData.maxValue } },
      ],
    });

    if (overlappingRate) {
      sendError(
        res,
        `Overlapping slab found: ${overlappingRate.minValue}-${overlappingRate.maxValue} for this zone and rate type`,
        400
      );
      return;
    }

    const rate = new ShippingRate({
      storeId: storeObjId,
      zoneId: zoneObjId,
      rateType: validatedData.rateType,
      minValue: validatedData.minValue,
      maxValue: validatedData.maxValue,
      baseRate: validatedData.baseRate,
      perUnitRate: validatedData.perUnitRate,
      codSurcharge: validatedData.codSurcharge,
      isActive: validatedData.isActive,
    });

    await rate.save();

    // Audit log
    await logAudit({
      req,
      action: 'SHIPPING_RATE_CREATED',
      entityType: 'ShippingRate',
      entityId: rate._id.toString(),
      description: `Shipping rate created: ${validatedData.rateType} ${validatedData.minValue}-${validatedData.maxValue} for zone ${zone.name}`,
      after: {
        zoneId: validatedData.zoneId,
        zoneName: zone.name,
        rateType: validatedData.rateType,
        slab: { min: validatedData.minValue, max: validatedData.maxValue },
        baseRate: validatedData.baseRate,
        perUnitRate: validatedData.perUnitRate,
        codSurcharge: validatedData.codSurcharge,
      },
    });

    sendSuccess(res, { rate }, 'Shipping rate created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    if (error instanceof Error && error.message.includes('Overlapping slab')) {
      sendError(res, error.message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/shipping/rates
 * Get shipping rates
 */
export const getShippingRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const zoneId = req.query.zoneId as string | undefined;
    const rateType = req.query.rateType as 'weight' | 'order_value' | undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (zoneId) query.zoneId = new mongoose.Types.ObjectId(zoneId);
    if (rateType) query.rateType = rateType;
    if (isActive !== undefined) query.isActive = isActive;

    const rates = await ShippingRate.find(query)
      .populate('zoneId', 'name countryCode')
      .sort({ zoneId: 1, rateType: 1, minValue: 1 })
      .lean();

    sendSuccess(res, { rates }, 'Shipping rates retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/shipping/rates/:id
 * Update shipping rate
 */
export const updateShippingRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = updateShippingRateSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const rate = await ShippingRate.findOne({
      _id: id,
      storeId: storeObjId,
    }).populate('zoneId', 'name');

    if (!rate) {
      sendError(res, 'Shipping rate not found', 404);
      return;
    }

    const before = {
      rateType: rate.rateType,
      minValue: rate.minValue,
      maxValue: rate.maxValue,
      baseRate: rate.baseRate,
      perUnitRate: rate.perUnitRate,
      codSurcharge: rate.codSurcharge,
      isActive: rate.isActive,
    };

    // Check for overlapping slabs if min/max values are being updated
    if (validatedData.minValue !== undefined || validatedData.maxValue !== undefined) {
      const newMinValue = validatedData.minValue !== undefined ? validatedData.minValue : rate.minValue;
      const newMaxValue = validatedData.maxValue !== undefined ? validatedData.maxValue : rate.maxValue;

      if (newMaxValue <= newMinValue) {
        sendError(res, 'Maximum value must be greater than minimum value', 400);
        return;
      }

      const overlappingRate = await ShippingRate.findOne({
        _id: { $ne: rate._id },
        storeId: storeObjId,
        zoneId: rate.zoneId,
        rateType: validatedData.rateType !== undefined ? validatedData.rateType : rate.rateType,
        isActive: true,
        $or: [
          { minValue: { $lte: newMinValue }, maxValue: { $gt: newMinValue } },
          { minValue: { $lt: newMaxValue }, maxValue: { $gte: newMaxValue } },
          { minValue: { $gte: newMinValue }, maxValue: { $lte: newMaxValue } },
        ],
      });

      if (overlappingRate) {
        sendError(
          res,
          `Overlapping slab found: ${overlappingRate.minValue}-${overlappingRate.maxValue}`,
          400
        );
        return;
      }
    }

    // Update fields
    if (validatedData.zoneId !== undefined) {
      const zoneObjId = new mongoose.Types.ObjectId(validatedData.zoneId);
      // Verify zone exists and belongs to store
      const zone = await ShippingZone.findOne({
        _id: zoneObjId,
        storeId: storeObjId,
      });
      if (!zone) {
        sendError(res, 'Shipping zone not found', 404);
        return;
      }
      rate.zoneId = zoneObjId;
    }
    if (validatedData.rateType !== undefined) rate.rateType = validatedData.rateType;
    if (validatedData.minValue !== undefined) rate.minValue = validatedData.minValue;
    if (validatedData.maxValue !== undefined) rate.maxValue = validatedData.maxValue;
    if (validatedData.baseRate !== undefined) rate.baseRate = validatedData.baseRate;
    if (validatedData.perUnitRate !== undefined) rate.perUnitRate = validatedData.perUnitRate;
    if (validatedData.codSurcharge !== undefined) rate.codSurcharge = validatedData.codSurcharge;
    if (validatedData.isActive !== undefined) rate.isActive = validatedData.isActive;

    await rate.save();

    // Audit log
    await logAudit({
      req,
      action: 'SHIPPING_RATE_UPDATED',
      entityType: 'ShippingRate',
      entityId: rate._id.toString(),
      description: `Shipping rate updated: ${rate.rateType} ${rate.minValue}-${rate.maxValue}`,
      before,
      after: {
        rateType: rate.rateType,
        minValue: rate.minValue,
        maxValue: rate.maxValue,
        baseRate: rate.baseRate,
        perUnitRate: rate.perUnitRate,
        codSurcharge: rate.codSurcharge,
        isActive: rate.isActive,
      },
      metadata: {
        zoneId: rate.zoneId.toString(),
        zoneName: (rate.zoneId as any).name || 'Unknown',
      },
    });

    sendSuccess(res, { rate }, 'Shipping rate updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    if (error instanceof Error && error.message.includes('Overlapping slab')) {
      sendError(res, error.message, 400);
      return;
    }
    next(error);
  }
};

