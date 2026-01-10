import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { CryptoPayment, Cryptocurrency } from '../models/CryptoPayment';
import { Order } from '../models/Order';
import { CryptoProvider } from '../payments/crypto.provider';
import { withTransaction } from '../utils/withTransaction';
import { createPaymentSplit } from '../services/splitPayment.service';
import { consumeInventory } from '../services/inventoryReservation.service';
import { generateInvoices } from '../services/invoiceGenerator.service';
import { eventStreamEmitter } from './eventController';

/**
 * Crypto Payment Controller
 * 
 * Handles cryptocurrency payment initiation, status checking, and webhook processing
 */

const createCryptoPaymentSchema = z.object({
  orderId: z.string(),
  cryptocurrency: z.enum(['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'MATIC']),
});

const checkPaymentStatusSchema = z.object({
  paymentId: z.string(),
});

/**
 * Create cryptocurrency payment
 * POST /api/payments/crypto/create
 */
export const createCryptoPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const validatedData = createCryptoPaymentSchema.parse(req.body);
    const { orderId, cryptocurrency } = validatedData;

    // Find order
    const order = await Order.findOne({
      orderId,
      storeId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Check if order is already paid
    if (order.status === 'paid') {
      sendError(res, 'Order is already paid', 400);
      return;
    }

    // Check if crypto payment already exists
    const existingPayment = await CryptoPayment.findOne({
      orderId: order._id,
      cryptocurrency,
      storeId,
    });

    if (existingPayment) {
      // Return existing payment
      sendSuccess(res, {
        paymentId: existingPayment._id.toString(),
        walletAddress: existingPayment.walletAddress,
        cryptocurrency: existingPayment.cryptocurrency,
        amountInCrypto: existingPayment.amountInCrypto,
        exchangeRate: existingPayment.exchangeRate,
        currency: existingPayment.currency,
        expiresAt: existingPayment.expiresAt,
        status: existingPayment.status,
        qrCodeData: `${cryptocurrency.toLowerCase()}:${existingPayment.walletAddress}?amount=${existingPayment.amountInCrypto}`,
      });
      return;
    }

    // Get store name for payment
    const { Store } = await import('../models/Store');
    const store = await Store.findById(storeId);
    const storeName = store?.name || 'Store';

    // Create crypto payment
    const cryptoProvider = new CryptoProvider();
    const paymentSession = await cryptoProvider.createOrderPayment({
      orderId: order.orderId,
      amount: Math.round(order.totalAmountWithTax || order.totalAmount || 0) * 100, // Convert to cents
      currency: 'USD', // Default, can be made configurable
      customerEmail: order.customerEmail || '',
      customerName: order.customerName || '',
      storeName,
      metadata: {
        storeId: storeId.toString(),
        orderId: order._id.toString(),
        cryptocurrency,
      },
    });

    // Find the created payment
    const cryptoPayment = await CryptoPayment.findById(paymentSession.providerOrderId);

    if (!cryptoPayment) {
      sendError(res, 'Failed to create crypto payment', 500);
      return;
    }

    sendSuccess(res, {
      paymentId: cryptoPayment._id.toString(),
      walletAddress: cryptoPayment.walletAddress,
      cryptocurrency: cryptoPayment.cryptocurrency,
      amountInCrypto: cryptoPayment.amountInCrypto,
      exchangeRate: cryptoPayment.exchangeRate,
      currency: cryptoPayment.currency,
      expiresAt: cryptoPayment.expiresAt,
      status: cryptoPayment.status,
      qrCodeData: paymentSession.metadata?.qrCodeData || '',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * Check cryptocurrency payment status
 * GET /api/payments/crypto/status/:paymentId
 */
export const checkCryptoPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { paymentId } = req.params;

    const cryptoPayment = await CryptoPayment.findOne({
      _id: paymentId,
      storeId,
    });

    if (!cryptoPayment) {
      sendError(res, 'Payment not found', 404);
      return;
    }

    // Check if payment has expired
    if (new Date() > cryptoPayment.expiresAt && cryptoPayment.status === 'pending') {
      cryptoPayment.status = 'expired';
      cryptoPayment.paymentStatus = 'failed';
      await cryptoPayment.save();
    }

    sendSuccess(res, {
      paymentId: cryptoPayment._id.toString(),
      walletAddress: cryptoPayment.walletAddress,
      cryptocurrency: cryptoPayment.cryptocurrency,
      amountInCrypto: cryptoPayment.amountInCrypto,
      exchangeRate: cryptoPayment.exchangeRate,
      currency: cryptoPayment.currency,
      status: cryptoPayment.status,
      paymentStatus: cryptoPayment.paymentStatus,
      transactionHash: cryptoPayment.transactionHash,
      confirmations: cryptoPayment.confirmations,
      requiredConfirmations: cryptoPayment.requiredConfirmations,
      expiresAt: cryptoPayment.expiresAt,
      qrCodeData: `${cryptoPayment.cryptocurrency.toLowerCase()}:${cryptoPayment.walletAddress}?amount=${cryptoPayment.amountInCrypto}`,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Webhook for cryptocurrency payment confirmation
 * POST /api/payments/crypto/webhook
 */
export const cryptoPaymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // In production, verify webhook signature
    const cryptoProvider = new CryptoProvider();
    const webhookResult = await cryptoProvider.handleWebhook(req.body);

    if (webhookResult.success && webhookResult.orderId) {
      const orderId = new mongoose.Types.ObjectId(webhookResult.orderId);

      await withTransaction(async (session) => {
        // Update order status
        const order = await Order.findById(orderId).session(session);
        if (order && order.status !== 'paid') {
          order.status = 'paid';
          order.paymentMethod = 'crypto';
          await order.save({ session });

          // Consume inventory reservation
          const consumeResult = await consumeInventory(order._id, {
            storeId: order.storeId.toString(),
          });

          if (!consumeResult.success) {
            console.error(
              `[CRYPTO WEBHOOK] Failed to consume inventory for order ${order.orderId}:`,
              consumeResult.error
            );
          }

          // Create payment split
          const cryptoPayment = await CryptoPayment.findOne({
            orderId: order._id,
          }).session(session);

          if (cryptoPayment) {
            const splitResult = await createPaymentSplit({
              order,
              paymentId: cryptoPayment._id,
              paymentMethod: 'crypto',
              actorRole: 'system',
            });

            if (!splitResult.success) {
              console.error(
                `[CRYPTO WEBHOOK] Failed to create payment split for order ${order.orderId}:`,
                splitResult.error
              );
            }

            // Generate invoices
            generateInvoices(order.orderId).catch((error: any) => {
              console.error(`[CRYPTO WEBHOOK] Failed to generate invoices for order ${order.orderId}:`, error);
            });

            // Emit PAYMENT_SUCCESS event
            eventStreamEmitter.emit('event', {
              eventType: 'order.paid',
              payload: {
                orderId: order.orderId,
                storeId: order.storeId.toString(),
                totalAmount: order.totalAmount,
                finalAmount: order.totalAmountWithTax || order.finalAmount || order.totalAmount,
                discountAmount: order.discountAmount || 0,
                provider: 'crypto',
                cryptocurrency: cryptoPayment.cryptocurrency,
              },
              storeId: order.storeId.toString(),
              userId: order.customerEmail || undefined,
              occurredAt: new Date(),
            });
          }
        }
      });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[CRYPTO WEBHOOK] Error:', error);
    next(error);
  }
};

/**
 * Manually confirm cryptocurrency payment (for testing/admin use)
 * POST /api/payments/crypto/confirm
 */
export const confirmCryptoPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    // Only allow admin/reseller to manually confirm
    if (currentUser.role !== 'admin' && currentUser.role !== 'reseller') {
      sendError(res, 'Unauthorized', 403);
      return;
    }

    const { paymentId, transactionHash } = req.body;

    if (!paymentId) {
      sendError(res, 'Payment ID is required', 400);
      return;
    }

    const cryptoPayment = await CryptoPayment.findOne({
      _id: paymentId,
      storeId,
    });

    if (!cryptoPayment) {
      sendError(res, 'Payment not found', 404);
      return;
    }

    // Update payment status
    cryptoPayment.status = 'confirmed';
    cryptoPayment.paymentStatus = 'paid';
    if (transactionHash) {
      cryptoPayment.transactionHash = transactionHash;
    }
    cryptoPayment.confirmations = cryptoPayment.requiredConfirmations;
    await cryptoPayment.save();

    // Trigger webhook handler to process order
    await cryptoPaymentWebhook(
      {
        body: {
          paymentId: cryptoPayment._id.toString(),
          status: 'confirmed',
          transactionHash: cryptoPayment.transactionHash,
          confirmations: cryptoPayment.confirmations,
        },
      } as any,
      res,
      next
    );
  } catch (error: any) {
    next(error);
  }
};

