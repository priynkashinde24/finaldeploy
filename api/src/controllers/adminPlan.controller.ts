import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Plan } from '../models/Plan';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Plan Controller
 * 
 * PURPOSE:
 * - Admin-only plan management
 * - Create, read, update, disable plans
 * - Plans control feature access & limits
 */

// Validation schemas
const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100, 'Plan name must not exceed 100 characters'),
  role: z.enum(['reseller', 'supplier']),
  priceMonthly: z.number().min(0, 'Monthly price must be non-negative'),
  priceYearly: z.number().min(0, 'Yearly price must be non-negative'),
  features: z.object({
    maxProducts: z.number().nullable().optional(),
    maxVariants: z.number().nullable().optional(),
    maxOrdersPerMonth: z.number().nullable().optional(),
    analyticsAccess: z.boolean().optional(),
    dynamicPricingAccess: z.boolean().optional(),
    aiPricingAccess: z.boolean().optional(),
    multiStoreAccess: z.boolean().optional(),
    customDomainAccess: z.boolean().optional(),
    prioritySupport: z.boolean().optional(),
  }),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priceMonthly: z.number().min(0).optional(),
  priceYearly: z.number().min(0).optional(),
  features: z
    .object({
      maxProducts: z.number().nullable().optional(),
      maxVariants: z.number().nullable().optional(),
      maxOrdersPerMonth: z.number().nullable().optional(),
      analyticsAccess: z.boolean().optional(),
      dynamicPricingAccess: z.boolean().optional(),
      aiPricingAccess: z.boolean().optional(),
      multiStoreAccess: z.boolean().optional(),
      customDomainAccess: z.boolean().optional(),
      prioritySupport: z.boolean().optional(),
    })
    .optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * POST /admin/plans
 * Create a new plan
 */
export const createPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create plans', 403);
      return;
    }

    // Validate request body
    const validatedData = createPlanSchema.parse(req.body);

    // Check if plan with same name and role already exists
    const existingPlan = await Plan.findOne({
      name: validatedData.name,
      role: validatedData.role,
    });

    if (existingPlan) {
      sendError(res, 'Plan with this name and role already exists', 400);
      return;
    }

    // Create plan
    const plan = new Plan({
      ...validatedData,
      createdBy: new mongoose.Types.ObjectId(currentUser.id),
      status: validatedData.status || 'active',
    });

    await plan.save();

    await plan.populate('createdBy', 'name email');

    sendSuccess(res, { plan }, 'Plan created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    if ((error as any).code === 11000) {
      sendError(res, 'Plan with this name and role already exists', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /admin/plans
 * Get all plans
 */
export const getPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view plans', 403);
      return;
    }

    const { role, status } = req.query;

    const filter: any = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const plans = await Plan.find(filter)
      .populate('createdBy', 'name email')
      .sort({ role: 1, priceMonthly: 1 })
      .lean();

    sendSuccess(res, { plans }, 'Plans retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/plans/:id
 * Update a plan
 */
export const updatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can update plans', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = updatePlanSchema.parse(req.body);

    // Find plan
    const plan = await Plan.findById(id);
    if (!plan) {
      sendError(res, 'Plan not found', 404);
      return;
    }

    // Check for duplicate name if updating
    if (validatedData.name && validatedData.name !== plan.name) {
      const existingPlan = await Plan.findOne({
        name: validatedData.name,
        role: plan.role,
        _id: { $ne: id },
      });

      if (existingPlan) {
        sendError(res, 'Plan with this name and role already exists', 400);
        return;
      }
    }

    // Update plan
    Object.assign(plan, validatedData);
    await plan.save();

    await plan.populate('createdBy', 'name email');

    sendSuccess(res, { plan }, 'Plan updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    if ((error as any).code === 11000) {
      sendError(res, 'Plan with this name and role already exists', 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/plans/:id/disable
 * Disable a plan
 */
export const disablePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable plans', 403);
      return;
    }

    const { id } = req.params;

    // Find plan
    const plan = await Plan.findById(id);
    if (!plan) {
      sendError(res, 'Plan not found', 404);
      return;
    }

    // Disable plan (inactive plans cannot be assigned)
    plan.status = 'inactive';
    await plan.save();

    sendSuccess(res, { plan }, 'Plan disabled successfully');
  } catch (error) {
    next(error);
  }
};

