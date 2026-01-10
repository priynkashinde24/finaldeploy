import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { getOrderTracking, ViewerContext } from '../services/orderTracking.service';
import { logAudit } from '../utils/auditLogger';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

/**
 * Order Tracking Controller
 * 
 * PURPOSE:
 * - Provide order tracking API for customers
 * - Support public tracking with email/phone verification
 * - Ensure security and multi-tenancy
 */

/**
 * Rate limiter for public tracking (prevent abuse)
 */
export const publicTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many tracking requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /orders/:orderNumber/track
 * Get order tracking information
 */
export const trackOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderNumber } = req.params;
    const { email, phone } = req.query;

    // Determine viewer context
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    let viewerContext: ViewerContext;

    if (currentUser) {
      // Authenticated user
      const userRole = currentUser.role;
      if (userRole === 'admin') {
        viewerContext = {
          type: 'admin',
          userId: currentUser.id,
          storeId: storeId,
        };
      } else if (userRole === 'reseller') {
        viewerContext = {
          type: 'reseller',
          userId: currentUser.id,
          storeId: storeId,
        };
      } else {
        // Customer
        viewerContext = {
          type: 'customer',
          userId: currentUser.id,
          storeId: storeId,
        };
      }
    } else {
      // Public tracking (requires email/phone)
      if (!email && !phone) {
        sendError(res, 'Email or phone required for public tracking', 400);
        return;
      }

      viewerContext = {
        type: 'public',
        email: email as string,
        phone: phone as string,
      };
    }

    // Get tracking data
    const result = await getOrderTracking(orderNumber, viewerContext);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 
                        result.error?.includes('Access denied') ? 403 : 400;
      sendError(res, result.error || 'Failed to fetch order tracking', statusCode);
      return;
    }

    // Audit log
    if (req) {
      await logAudit({
        req,
        action: 'ORDER_TRACK_VIEWED',
        entityType: 'Order',
        entityId: orderNumber,
        description: `Order tracking viewed: ${orderNumber}`,
        metadata: {
          viewerType: viewerContext.type,
          orderNumber,
        },
      });
    }

    sendSuccess(res, result.data, 'Order tracking data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /orders/:orderNumber/track/public
 * Public tracking endpoint (with rate limiting)
 */
export const trackOrderPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderNumber } = req.params;
    const { email, phone } = req.query;

    if (!email && !phone) {
      sendError(res, 'Email or phone required for public tracking', 400);
      return;
    }

    const viewerContext: ViewerContext = {
      type: 'public',
      email: email as string,
      phone: phone as string,
    };

    // Get tracking data
    const result = await getOrderTracking(orderNumber, viewerContext);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 
                        result.error?.includes('Access denied') ? 403 : 400;
      sendError(res, result.error || 'Failed to fetch order tracking', statusCode);
      return;
    }

    // Audit log
    if (req) {
      await logAudit({
        req,
        action: 'ORDER_TRACK_VIEWED',
        entityType: 'Order',
        entityId: orderNumber,
        description: `Public order tracking viewed: ${orderNumber}`,
        metadata: {
          viewerType: 'public',
          orderNumber,
        },
      });
    }

    sendSuccess(res, result.data, 'Order tracking data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

