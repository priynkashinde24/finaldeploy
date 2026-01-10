import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { Cart } from '../models/Cart';
import { CartRecoveryToken, verifyToken, hashToken } from '../models/CartRecoveryToken';
import { CartRecoveryMetrics } from '../models/CartRecoveryMetrics';
import { CartRecoveryUnsubscribe } from '../models/CartRecoveryUnsubscribe';
import { WhatsAppRecoveryMetrics } from '../models/WhatsAppRecoveryMetrics';
import { WhatsAppMessageLog } from '../models/WhatsAppMessageLog';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from './eventController';
import rateLimit from 'express-rate-limit';

/**
 * Cart Recovery Controller
 *
 * PURPOSE:
 * - Handle cart recovery via secure token
 * - Restore cart state
 * - Track recovery metrics
 * - Support unsubscribe
 */

// Rate limiting for recovery endpoint
export const recoveryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many recovery attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /cart/recover
 * Recover abandoned cart via token
 */
export const recoverCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, unsubscribe } = req.query;

    if (!token || typeof token !== 'string') {
      sendError(res, 'Recovery token is required', 400);
      return;
    }

    // Handle unsubscribe
    if (unsubscribe === 'true') {
      await handleUnsubscribe(token, req, res);
      return;
    }

    // STEP 1: Find recovery token
    const tokenHash = hashToken(token);
    const recoveryToken = await CartRecoveryToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!recoveryToken) {
      sendError(res, 'Invalid or expired recovery token', 400);
      return;
    }

    // STEP 2: Fetch cart
    const cart = await Cart.findById(recoveryToken.cartId);

    if (!cart) {
      sendError(res, 'Cart not found', 404);
      return;
    }

    // STEP 3: Check if cart is still abandoned
    if (cart.status !== 'abandoned') {
      sendError(res, `Cart is no longer available. Status: ${cart.status}`, 400);
      return;
    }

    // STEP 4: Mark token as used
    recoveryToken.usedAt = new Date();
    await recoveryToken.save();

    // STEP 5: Restore cart (mark as active)
    cart.status = 'active';
    cart.lastUpdatedAt = new Date();
    await cart.save();

    // STEP 6: Update email recovery metrics
    const emailMetrics = await CartRecoveryMetrics.findOne({
      cartId: cart._id,
      recoveryTokenId: recoveryToken._id,
    });

    if (emailMetrics) {
      emailMetrics.recoveredAt = new Date();
      await emailMetrics.save();
    }

    // STEP 6a: Update WhatsApp recovery metrics (if recovered via WhatsApp)
    const whatsappMessageLog = await WhatsAppMessageLog.findOne({
      cartId: cart._id,
      recoveryTokenId: recoveryToken._id,
    });

    if (whatsappMessageLog) {
      const whatsappMetrics = await WhatsAppRecoveryMetrics.findOne({
        messageLogId: whatsappMessageLog._id,
      });

      if (whatsappMetrics) {
        whatsappMetrics.clickedAt = new Date();
        whatsappMetrics.recoveredAt = new Date();
        await whatsappMetrics.save();
      }
    }

    // STEP 7: Audit log
    await logAudit({
      storeId: cart.storeId.toString(),
      actorRole: 'system',
      action: 'CART_RECOVERED',
      entityType: 'Cart',
      entityId: cart._id.toString(),
      description: `Cart recovered via recovery link`,
      metadata: {
        cartId: cart._id.toString(),
        email: recoveryToken.email,
        tokenId: recoveryToken._id.toString(),
      },
    });

    // STEP 8: Emit event
    eventStreamEmitter.emit('event', {
      eventType: 'CART_RECOVERED',
      payload: {
        cartId: cart._id.toString(),
        email: recoveryToken.email,
      },
      storeId: cart.storeId.toString(),
      userId: cart.userId?.toString() || recoveryToken.email,
      occurredAt: new Date(),
    });

    // STEP 9: Return cart data (frontend will restore to session)
    sendSuccess(res, {
      cart: {
        id: cart._id.toString(),
        items: cart.items,
        subtotal: cart.subtotal,
        taxEstimate: cart.taxEstimate,
        totalEstimate: cart.totalEstimate,
        couponCode: cart.couponCode,
        discountAmount: cart.discountAmount,
      },
      redirectUrl: `/checkout?recovered=true`,
      message: 'Cart recovered successfully',
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Handle unsubscribe from recovery emails
 */
async function handleUnsubscribe(
  token: string,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tokenHash = hashToken(token);
    const recoveryToken = await CartRecoveryToken.findOne({
      tokenHash,
    });

    if (!recoveryToken) {
      sendError(res, 'Invalid token', 400);
      return;
    }

    // Create unsubscribe record
    const storeId = recoveryToken.cartId; // Get storeId from cart
    const cart = await Cart.findById(recoveryToken.cartId).select('storeId').lean();
    if (cart) {
      const unsubscribe = new CartRecoveryUnsubscribe({
        storeId: cart.storeId,
        email: recoveryToken.email.toLowerCase(),
        userId: recoveryToken.userId || null,
        unsubscribedAt: new Date(),
        reason: 'User clicked unsubscribe link',
      });
      await unsubscribe.save();
    }

    // Mark token as used to prevent further emails
    recoveryToken.usedAt = new Date();
    await recoveryToken.save();

    // Audit log
    await logAudit({
      storeId: recoveryToken.cartId.toString(),
      actorRole: 'system',
      action: 'CART_RECOVERY_UNSUBSCRIBED',
      entityType: 'CartRecoveryToken',
      entityId: recoveryToken._id.toString(),
      description: `User unsubscribed from cart recovery emails`,
      metadata: {
        email: recoveryToken.email,
        tokenId: recoveryToken._id.toString(),
      },
    });

    sendSuccess(res, {
      message: 'You have been unsubscribed from cart recovery emails',
    });
  } catch (error: any) {
    sendError(res, 'Failed to unsubscribe', 500);
  }
}

/**
 * GET /cart/recovery/metrics
 * Get recovery metrics (admin only)
 */
export const getRecoveryMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter: any = { storeId: storeObjId };

    if (startDate || endDate) {
      filter.sentAt = {};
      if (startDate) {
        filter.sentAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        filter.sentAt.$lte = new Date(endDate as string);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [metrics, total] = await Promise.all([
      CartRecoveryMetrics.find(filter)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('cartId', 'items totalEstimate')
        .populate('orderId', 'orderNumber grandTotal')
        .lean(),
      CartRecoveryMetrics.countDocuments(filter),
    ]);

    // Calculate aggregate metrics
    const totalSent = await CartRecoveryMetrics.countDocuments({
      ...filter,
      sentAt: { $exists: true },
    });

    const totalOpened = await CartRecoveryMetrics.countDocuments({
      ...filter,
      openedAt: { $exists: true },
    });

    const totalClicked = await CartRecoveryMetrics.countDocuments({
      ...filter,
      clickedAt: { $exists: true },
    });

    const totalRecovered = await CartRecoveryMetrics.countDocuments({
      ...filter,
      recoveredAt: { $exists: true },
    });

    const totalConverted = await CartRecoveryMetrics.countDocuments({
      ...filter,
      convertedAt: { $exists: true },
    });

    const totalRevenue = await CartRecoveryMetrics.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$revenue' } } },
    ]);

    sendSuccess(res, {
      metrics,
      aggregates: {
        totalSent,
        totalOpened,
        totalClicked,
        totalRecovered,
        totalConverted,
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        recoveryRate: totalSent > 0 ? (totalRecovered / totalSent) * 100 : 0,
        conversionRate: totalRecovered > 0 ? (totalConverted / totalRecovered) * 100 : 0,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error: any) {
    next(error);
  }
};

