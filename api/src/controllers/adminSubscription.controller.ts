import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Subscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Admin Subscription Controller
 * 
 * PURPOSE:
 * - Admin-only subscription management
 * - Assign plans to users
 * - Cancel subscriptions
 * - Extend trials
 */

// Validation schemas
const assignPlanSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['monthly', 'yearly']),
  startDate: z.string().optional(), // ISO date string
  trialDays: z.number().min(0).max(90).optional(), // Trial period in days
});

const extendTrialSchema = z.object({
  days: z.number().min(1).max(90, 'Trial extension cannot exceed 90 days'),
});

/**
 * GET /admin/subscriptions
 * Get all subscriptions
 */
export const getSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view subscriptions', 403);
      return;
    }

    const { role, status, userId } = req.query;

    const filter: any = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (userId) filter.userId = new mongoose.Types.ObjectId(userId as string);

    const subscriptions = await Subscription.find(filter)
      .populate('userId', 'name email role')
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { subscriptions }, 'Subscriptions retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/subscriptions/:id/assign-plan
 * Assign a plan to a user
 */
export const assignPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can assign plans', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = assignPlanSchema.parse(req.body);

    // Find plan
    const plan = await Plan.findById(validatedData.planId);
    if (!plan) {
      sendError(res, 'Plan not found', 404);
      return;
    }

    if (plan.status !== 'active') {
      sendError(res, 'Cannot assign inactive plan', 400);
      return;
    }

    const userId = new mongoose.Types.ObjectId(validatedData.userId);

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      userId,
      status: { $in: ['trial', 'active', 'past_due'] },
    });

    if (existingSubscription) {
      sendError(
        res,
        'User already has an active subscription. Cancel it first or update the existing subscription.',
        400
      );
      return;
    }

    // Calculate dates
    const startDate = validatedData.startDate ? new Date(validatedData.startDate) : new Date();
    const trialDays = validatedData.trialDays || 0;
    const trialEndDate = trialDays > 0 ? new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

    // Calculate end date based on billing cycle
    const endDate = new Date(startDate);
    if (validatedData.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create subscription
    const subscription = new Subscription({
      userId,
      role: plan.role,
      planId: plan._id,
      billingCycle: validatedData.billingCycle,
      startDate,
      endDate,
      status: trialDays > 0 ? 'trial' : 'active',
      trialEndDate,
      usage: {
        productsUsed: 0,
        variantsUsed: 0,
        ordersThisMonth: 0,
        lastResetDate: new Date(),
      },
    });

    await subscription.save();

    await subscription.populate('userId', 'name email role');
    await subscription.populate('planId');

    sendSuccess(res, { subscription }, 'Plan assigned successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /admin/subscriptions/:id/cancel
 * Cancel a subscription
 */
export const cancelSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can cancel subscriptions', 403);
      return;
    }

    const { id } = req.params;

    // Find subscription
    const subscription = await Subscription.findById(id);
    if (!subscription) {
      sendError(res, 'Subscription not found', 404);
      return;
    }

    if (subscription.status === 'cancelled') {
      sendError(res, 'Subscription is already cancelled', 400);
      return;
    }

    // Cancel subscription
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancelledBy = new mongoose.Types.ObjectId(currentUser.id);
    await subscription.save();

    await subscription.populate('userId', 'name email role');
    await subscription.populate('planId');

    sendSuccess(res, { subscription }, 'Subscription cancelled successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/subscriptions/:id/extend-trial
 * Extend trial period
 */
export const extendTrial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can extend trials', 403);
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = extendTrialSchema.parse(req.body);

    // Find subscription
    const subscription = await Subscription.findById(id);
    if (!subscription) {
      sendError(res, 'Subscription not found', 404);
      return;
    }

    if (subscription.status !== 'trial') {
      sendError(res, 'Subscription is not in trial status', 400);
      return;
    }

    // Extend trial
    const currentTrialEnd = subscription.trialEndDate || subscription.endDate;
    const newTrialEnd = new Date(currentTrialEnd.getTime() + validatedData.days * 24 * 60 * 60 * 1000);
    subscription.trialEndDate = newTrialEnd;
    subscription.endDate = newTrialEnd; // Also extend end date
    await subscription.save();

    await subscription.populate('userId', 'name email role');
    await subscription.populate('planId');

    sendSuccess(res, { subscription }, 'Trial extended successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

