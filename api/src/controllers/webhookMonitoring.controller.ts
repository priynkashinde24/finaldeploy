import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { WebhookRetry } from '../models/WebhookRetry';
import { StripeWebhookEvent } from '../models/StripeWebhookEvent';
import { authenticate, authorize } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

/**
 * Webhook Monitoring Controller
 * 
 * PURPOSE:
 * - Monitor webhook health
 * - View retry status
 * - Dashboard for webhook metrics
 */

/**
 * GET /admin/webhooks/health
 * Get webhook health metrics (Admin only)
 */
export const getWebhookHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Only admins can view webhook health', 403);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get webhook event stats (storeId is optional, so we'll filter if provided)
    const eventFilter: any = { createdAt: { $gte: last24Hours } };
    if (storeId) {
      // Note: StripeWebhookEvent doesn't have storeId, so we'll get all events
      // In production, you might want to add storeId to webhook events
    }

    const totalEvents = await StripeWebhookEvent.countDocuments(eventFilter);

    const processedEvents = await StripeWebhookEvent.countDocuments({
      ...eventFilter,
      processed: true,
    });

    const failedEvents = await StripeWebhookEvent.countDocuments({
      ...eventFilter,
      processed: false,
      error: { $exists: true, $ne: null },
    });

    // Get retry stats
    const pendingRetries = await WebhookRetry.countDocuments({
      status: 'pending',
    });

    const processingRetries = await WebhookRetry.countDocuments({
      status: 'processing',
    });

    const abandonedRetries = await WebhookRetry.countDocuments({
      status: 'abandoned',
    });

    const health = {
      events: {
        total: totalEvents,
        processed: processedEvents,
        failed: failedEvents,
        successRate: totalEvents > 0 ? ((processedEvents / totalEvents) * 100).toFixed(2) : '100.00',
      },
      retries: {
        pending: pendingRetries,
        processing: processingRetries,
        abandoned: abandonedRetries,
      },
      status: failedEvents === 0 && pendingRetries === 0 ? 'healthy' : 'warning',
    };

    sendSuccess(res, { health }, 'Webhook health fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/webhooks/retries
 * Get webhook retries (Admin only)
 */
export const getWebhookRetries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Only admins can view webhook retries', 403);
      return;
    }

    const { status, limit = 50 } = req.query;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const retries = await WebhookRetry.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    sendSuccess(res, { retries }, 'Webhook retries fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/webhooks/retries/:id/retry
 * Manually retry a webhook (Admin only)
 */
export const retryWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { id } = req.params;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can retry webhooks', 403);
      return;
    }

    const retry = await WebhookRetry.findById(id);

    if (!retry) {
      sendError(res, 'Webhook retry not found', 404);
      return;
    }

    if (retry.status === 'succeeded') {
      sendError(res, 'Webhook already succeeded', 400);
      return;
    }

    // Reset retry
    retry.status = 'pending';
    retry.retryCount = 0;
    retry.nextRetryAt = new Date();
    retry.error = undefined;
    await retry.save();

    sendSuccess(res, { retry }, 'Webhook retry queued successfully');
  } catch (error) {
    next(error);
  }
};

