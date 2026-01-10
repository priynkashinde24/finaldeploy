import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MarginAlert } from '../models/MarginAlert';
import { sendSuccess, sendError } from '../utils/responseFormatter';

/**
 * Alert Controller
 * 
 * PURPOSE:
 * - Admin and reseller alert management
 * - View, acknowledge, and resolve margin alerts
 * - Never auto-change prices
 */

/**
 * GET /admin/margin-alerts
 * Get all margin alerts (admin only)
 */
export const getAdminMarginAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view all margin alerts', 403);
      return;
    }

    const { status, severity, alertType, scope, resellerId } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (alertType) filter.alertType = alertType;
    if (scope) filter.scope = scope;
    if (resellerId) filter.resellerId = new mongoose.Types.ObjectId(resellerId as string);

    const alerts = await MarginAlert.find(filter)
      .populate('resellerId', 'name email')
      .populate('acknowledgedBy', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ severity: -1, createdAt: -1 }) // High severity first, then newest
      .lean();

    sendSuccess(res, { alerts }, 'Margin alerts retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /reseller/margin-alerts
 * Get margin alerts for current reseller
 */
export const getResellerMarginAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view their margin alerts', 403);
      return;
    }

    const { status, severity } = req.query;

    const filter: any = {
      resellerId: new mongoose.Types.ObjectId(currentUser.id),
    };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const alerts = await MarginAlert.find(filter)
      .sort({ severity: -1, createdAt: -1 })
      .lean();

    sendSuccess(res, { alerts }, 'Margin alerts retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/margin-alerts/:id/acknowledge
 * Acknowledge a margin alert (admin only)
 */
export const acknowledgeMarginAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can acknowledge margin alerts', 403);
      return;
    }

    const { id } = req.params;

    const alert = await MarginAlert.findById(id);
    if (!alert) {
      sendError(res, 'Margin alert not found', 404);
      return;
    }

    if (alert.status === 'resolved') {
      sendError(res, 'Cannot acknowledge a resolved alert', 400);
      return;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = new mongoose.Types.ObjectId(currentUser.id);
    alert.acknowledgedAt = new Date();
    await alert.save();

    await alert.populate('acknowledgedBy', 'name email');

    sendSuccess(res, { alert }, 'Margin alert acknowledged successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/margin-alerts/:id/resolve
 * Resolve a margin alert (admin only)
 */
export const resolveMarginAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can resolve margin alerts', 403);
      return;
    }

    const { id } = req.params;

    const alert = await MarginAlert.findById(id);
    if (!alert) {
      sendError(res, 'Margin alert not found', 404);
      return;
    }

    if (alert.status === 'resolved') {
      sendError(res, 'Alert is already resolved', 400);
      return;
    }

    alert.status = 'resolved';
    alert.resolvedBy = new mongoose.Types.ObjectId(currentUser.id);
    alert.resolvedAt = new Date();
    await alert.save();

    await alert.populate('resolvedBy', 'name email');

    sendSuccess(res, { alert }, 'Margin alert resolved successfully');
  } catch (error) {
    next(error);
  }
};

