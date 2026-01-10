import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { TaxRate, ITaxRate } from '../models/TaxRate';
import { TaxProfile, ITaxProfile } from '../models/TaxProfile';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Admin Tax Management Controller
 * 
 * PURPOSE:
 * - Manage tax rates per country/category
 * - Manage tax profiles for entities
 * - Admin-only access
 */

const createTaxRateSchema = z.object({
  countryCode: z.string().length(2).transform((val) => val.toUpperCase()),
  taxType: z.enum(['GST', 'VAT']),
  categoryId: z.string().optional().nullable(),
  rate: z.number().min(0).max(100),
  components: z
    .object({
      cgst: z.number().min(0).max(100).optional(),
      sgst: z.number().min(0).max(100).optional(),
      igst: z.number().min(0).max(100).optional(),
      vat: z.number().min(0).max(100).optional(),
    })
    .optional(),
  isActive: z.boolean().default(true),
  exemptionReason: z.string().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional().nullable(),
});

const updateTaxRateSchema = createTaxRateSchema.partial();

const createTaxProfileSchema = z.object({
  entityType: z.enum(['store', 'supplier', 'reseller', 'platform']),
  entityId: z.string().min(1),
  countryCode: z.string().length(2).transform((val) => val.toUpperCase()),
  stateCode: z.string().optional(),
  gstin: z.string().optional(),
  vatNumber: z.string().optional(),
  isRegistered: z.boolean().default(false),
  registrationDate: z.string().datetime().optional(),
  businessName: z.string().optional(),
  businessAddress: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /admin/tax-rates
 * Create tax rate
 */
export const createTaxRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createTaxRateSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Check for existing active rate
    const categoryObjId = validatedData.categoryId ? new mongoose.Types.ObjectId(validatedData.categoryId) : null;
    const existingRate = await TaxRate.findOne({
      storeId: storeObjId,
      countryCode: validatedData.countryCode,
      categoryId: categoryObjId,
      isActive: true,
    });

    if (existingRate) {
      sendError(res, 'An active tax rate already exists for this country/category', 400);
      return;
    }

    const taxRate = new TaxRate({
      storeId: storeObjId,
      countryCode: validatedData.countryCode,
      taxType: validatedData.taxType,
      categoryId: categoryObjId,
      rate: validatedData.rate,
      components: validatedData.components,
      isActive: validatedData.isActive,
      exemptionReason: validatedData.exemptionReason,
      effectiveFrom: validatedData.effectiveFrom ? new Date(validatedData.effectiveFrom) : new Date(),
      effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : null,
    });

    await taxRate.save();

    // Audit log
    await logAudit({
      req,
      action: 'TAX_RATE_CREATED',
      entityType: 'TaxRate',
      entityId: taxRate._id.toString(),
      description: `Tax rate created: ${validatedData.taxType} ${validatedData.rate}% for ${validatedData.countryCode}`,
      after: {
        countryCode: validatedData.countryCode,
        taxType: validatedData.taxType,
        rate: validatedData.rate,
        categoryId: validatedData.categoryId,
      },
      metadata: {
        components: validatedData.components,
      },
    });

    sendSuccess(res, { taxRate }, 'Tax rate created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/tax-rates
 * Get tax rates with filters
 */
export const getTaxRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const countryCode = req.query.countryCode as string | undefined;
    const taxType = req.query.taxType as 'GST' | 'VAT' | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (countryCode) query.countryCode = countryCode.toUpperCase();
    if (taxType) query.taxType = taxType;
    if (categoryId) query.categoryId = new mongoose.Types.ObjectId(categoryId);
    if (isActive !== undefined) query.isActive = isActive;

    const taxRates = await TaxRate.find(query)
      .populate('categoryId', 'name slug')
      .sort({ countryCode: 1, taxType: 1, createdAt: -1 })
      .lean();

    sendSuccess(res, { taxRates }, 'Tax rates retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/tax-rates/:id
 * Update tax rate
 */
export const updateTaxRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = updateTaxRateSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const taxRate = await TaxRate.findOne({
      _id: id,
      storeId: storeObjId,
    });

    if (!taxRate) {
      sendError(res, 'Tax rate not found', 404);
      return;
    }

    const before = {
      rate: taxRate.rate,
      isActive: taxRate.isActive,
      components: taxRate.components,
    };

    // Update fields
    if (validatedData.rate !== undefined) taxRate.rate = validatedData.rate;
    if (validatedData.components !== undefined) taxRate.components = validatedData.components as any;
    if (validatedData.isActive !== undefined) taxRate.isActive = validatedData.isActive;
    if (validatedData.exemptionReason !== undefined) taxRate.exemptionReason = validatedData.exemptionReason;
    if (validatedData.effectiveFrom !== undefined && typeof validatedData.effectiveFrom === 'string')
      taxRate.effectiveFrom = new Date(validatedData.effectiveFrom);
    if (validatedData.effectiveTo !== undefined) {
      if (validatedData.effectiveTo === null) {
        taxRate.effectiveTo = null as any; // TaxRate model allows null
      } else if (typeof validatedData.effectiveTo === 'string') {
        taxRate.effectiveTo = new Date(validatedData.effectiveTo);
      }
    }

    await taxRate.save();

    // Audit log
    await logAudit({
      req,
      action: 'TAX_RATE_UPDATED',
      entityType: 'TaxRate',
      entityId: taxRate._id.toString(),
      description: `Tax rate updated: ${taxRate.taxType} ${taxRate.rate}%`,
      before,
      after: {
        rate: taxRate.rate,
        isActive: taxRate.isActive,
        components: taxRate.components,
      },
    });

    sendSuccess(res, { taxRate }, 'Tax rate updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * POST /admin/tax-profiles
 * Create or update tax profile
 */
export const createTaxProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = createTaxProfileSchema.parse(req.body);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Check if profile exists
    const existingProfile = await TaxProfile.findOne({
      storeId: storeObjId,
      entityType: validatedData.entityType,
      entityId: validatedData.entityId,
    });

    let taxProfile: ITaxProfile;
    let isNew = false;

    if (existingProfile) {
      // Update existing
      existingProfile.countryCode = validatedData.countryCode;
      if (validatedData.stateCode !== undefined) existingProfile.stateCode = validatedData.stateCode;
      if (validatedData.gstin !== undefined) existingProfile.gstin = validatedData.gstin;
      if (validatedData.vatNumber !== undefined) existingProfile.vatNumber = validatedData.vatNumber;
      if (validatedData.isRegistered !== undefined) existingProfile.isRegistered = validatedData.isRegistered;
      if (validatedData.registrationDate !== undefined && typeof validatedData.registrationDate === 'string')
        existingProfile.registrationDate = new Date(validatedData.registrationDate);
      if (validatedData.businessName !== undefined) existingProfile.businessName = validatedData.businessName;
      if (validatedData.businessAddress !== undefined) existingProfile.businessAddress = validatedData.businessAddress as any;

      await existingProfile.save();
      taxProfile = existingProfile;
    } else {
      // Create new
      isNew = true;
      taxProfile = new TaxProfile({
        storeId: storeObjId,
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        countryCode: validatedData.countryCode,
        stateCode: validatedData.stateCode,
        gstin: validatedData.gstin,
        vatNumber: validatedData.vatNumber,
        isRegistered: validatedData.isRegistered,
        registrationDate: validatedData.registrationDate && typeof validatedData.registrationDate === 'string' 
          ? new Date(validatedData.registrationDate) 
          : undefined,
        businessName: validatedData.businessName,
        businessAddress: validatedData.businessAddress as any,
      });

      await taxProfile.save();
    }

    // Audit log
    await logAudit({
      req,
      action: isNew ? 'TAX_PROFILE_CREATED' : 'TAX_PROFILE_UPDATED',
      entityType: 'TaxProfile',
      entityId: taxProfile._id.toString(),
      description: `Tax profile ${isNew ? 'created' : 'updated'} for ${validatedData.entityType} ${validatedData.entityId}`,
      after: {
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        countryCode: validatedData.countryCode,
        isRegistered: validatedData.isRegistered,
      },
      metadata: {
        gstin: validatedData.gstin,
        vatNumber: validatedData.vatNumber,
      },
    });

    sendSuccess(res, { taxProfile }, `Tax profile ${isNew ? 'created' : 'updated'} successfully`, isNew ? 201 : 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/tax-profiles
 * Get tax profiles
 */
export const getTaxProfiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const entityType = req.query.entityType as 'store' | 'supplier' | 'reseller' | 'platform' | undefined;
    const entityId = req.query.entityId as string | undefined;
    const countryCode = req.query.countryCode as string | undefined;

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (countryCode) query.countryCode = countryCode.toUpperCase();

    const taxProfiles = await TaxProfile.find(query)
      .sort({ entityType: 1, entityId: 1, createdAt: -1 })
      .lean();

    sendSuccess(res, { taxProfiles }, 'Tax profiles retrieved successfully');
  } catch (error) {
    next(error);
  }
};
