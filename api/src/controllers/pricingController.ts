import { Request, Response, NextFunction } from 'express';
import { PricingRule } from '../models/PricingRule';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { calculateFinalPrice, getPricingBreakdown } from '../services/pricingService';
import { z } from 'zod';

const globalMarkupSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  markupPercent: z.number().min(-100, 'Markup percent cannot be less than -100%'),
});

const overrideSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  sku: z.string().min(1, 'SKU is required'),
  markupPercent: z.number().min(-100, 'Markup percent cannot be less than -100%'),
});

export const setGlobalMarkup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = globalMarkupSchema.parse(req.body);

    // Upsert global rule (one per store)
    const rule = await PricingRule.findOneAndUpdate(
      {
        storeId: validatedData.storeId,
        type: 'global',
      },
      {
        storeId: validatedData.storeId,
        type: 'global',
        sku: null,
        markupPercent: validatedData.markupPercent,
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    sendSuccess(res, rule, 'Global markup set successfully');
  } catch (error) {
    next(error);
  }
};

export const setSkuOverride = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = overrideSchema.parse(req.body);

    // Upsert override rule (one per store+sku)
    const rule = await PricingRule.findOneAndUpdate(
      {
        storeId: validatedData.storeId,
        type: 'override',
        sku: validatedData.sku,
      },
      {
        storeId: validatedData.storeId,
        type: 'override',
        sku: validatedData.sku,
        markupPercent: validatedData.markupPercent,
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    sendSuccess(res, rule, 'SKU override set successfully');
  } catch (error) {
    next(error);
  }
};

export const getCalculatedPrice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storeId, sku } = req.params;
    const basePrice = parseFloat(req.query.basePrice as string);

    if (!storeId || !sku) {
      sendError(res, 'Store ID and SKU are required', 400);
      return;
    }

    if (isNaN(basePrice) || basePrice < 0) {
      sendError(res, 'Valid base price is required', 400);
      return;
    }

    const finalPrice = await calculateFinalPrice(storeId, sku, basePrice);
    const breakdown = await getPricingBreakdown(storeId, sku, basePrice);

    sendSuccess(
      res,
      {
        storeId,
        sku,
        basePrice,
        finalPrice,
        breakdown,
      },
      'Price calculated successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getStorePricingRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const rules = await PricingRule.find({ storeId }).sort({ type: 1, createdAt: -1 });

    const globalRule = rules.find((r) => r.type === 'global');
    const overrides = rules.filter((r) => r.type === 'override');

    sendSuccess(
      res,
      {
        storeId,
        globalMarkup: globalRule ? globalRule.markupPercent : null,
        overrides: overrides.map((r) => ({
          _id: r._id,
          sku: r.sku,
          markupPercent: r.markupPercent,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      },
      'Pricing rules retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const deleteOverride = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storeId, overrideId } = req.params;

    if (!storeId || !overrideId) {
      sendError(res, 'Store ID and Override ID are required', 400);
      return;
    }

    const rule = await PricingRule.findOneAndDelete({
      _id: overrideId,
      storeId,
      type: 'override',
    });

    if (!rule) {
      sendError(res, 'Override rule not found', 404);
      return;
    }

    // Use the overrideId from params since we already have it, avoiding ModifyResult type issues
    sendSuccess(res, { id: overrideId }, 'Override rule deleted successfully');
  } catch (error) {
    next(error);
  }
};

