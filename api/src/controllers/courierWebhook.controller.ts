import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Courier } from '../models/Courier';
import { ShippingLabel } from '../models/ShippingLabel';
import { Order } from '../models/Order';
import { createCourierApiClient } from '../services/courierApi/courierApi.factory';
import { syncOrderTracking } from '../services/courierTrackingSync.service';
import mongoose from 'mongoose';

/**
 * Courier Webhook Controller
 * 
 * PURPOSE:
 * - Handle webhooks from courier APIs (Shiprocket, Delhivery)
 * - Update order status based on courier tracking updates
 * - Verify webhook signatures
 * - Idempotent processing
 */

/**
 * POST /api/webhooks/courier/:courierId
 * Handle courier webhook events
 */
export const handleCourierWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courierId } = req.params;
    const signature = req.headers['x-courier-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    // Get courier
    const courier = await Courier.findById(courierId).lean();
    if (!courier || !courier.apiConfig?.enabled) {
      sendError(res, 'Courier not found or API not enabled', 404);
      return;
    }

    // Verify webhook signature
    const apiClient = createCourierApiClient(courier.apiConfig);
    if (apiClient && signature) {
      const isValid = apiClient.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        sendError(res, 'Invalid webhook signature', 401);
        return;
      }
    }

    // Extract tracking data from webhook
    const webhookData = req.body;
    const awbNumber = webhookData.awb || webhookData.waybill || webhookData.shipment_id;

    if (!awbNumber) {
      sendError(res, 'AWB number not found in webhook', 400);
      return;
    }

    // Find shipping label by AWB
    const shippingLabel = await ShippingLabel.findOne({
      awbNumber,
      status: 'generated',
    }).lean();

    if (!shippingLabel) {
      // Webhook received but no label found - still return 200 to prevent retries
      sendSuccess(res, { status: 'received', message: 'Label not found' }, 'Webhook received');
      return;
    }

    // Sync tracking for this order
    if (!shippingLabel.orderId) {
      sendError(res, 'Order ID not found in shipping label', 400);
      return;
    }
    const syncResult = await syncOrderTracking(shippingLabel.orderId);

    if (syncResult.success) {
      sendSuccess(
        res,
        { status: 'processed', orderId: syncResult.orderId, statusUpdated: syncResult.statusUpdated },
        'Webhook processed successfully'
      );
    } else {
      // Log error but still return 200 to prevent webhook retries
      console.error('[COURIER WEBHOOK] Sync error:', syncResult.error);
      sendSuccess(res, { status: 'received', error: syncResult.error }, 'Webhook received');
    }
  } catch (error: any) {
    console.error('[COURIER WEBHOOK] Error:', error);
    // Always return 200 to prevent webhook retries
    sendSuccess(res, { status: 'received', error: error.message }, 'Webhook received');
  }
};

/**
 * POST /api/webhooks/courier/shiprocket
 * Handle Shiprocket webhook (specific endpoint)
 */
export const handleShiprocketWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['x-shiprocket-signature'] as string;
    const webhookData = req.body;

    // Find courier by provider
    const courier = await Courier.findOne({
      'apiConfig.provider': 'shiprocket',
      'apiConfig.enabled': true,
    }).lean();

    if (!courier) {
      sendError(res, 'Shiprocket courier not configured', 404);
      return;
    }

    // Verify signature if webhook secret is configured
    if (courier.apiConfig?.webhookSecret && signature) {
      const apiClient = createCourierApiClient(courier.apiConfig);
      if (apiClient) {
        const isValid = apiClient.verifyWebhookSignature(JSON.stringify(webhookData), signature);
        if (!isValid) {
          sendError(res, 'Invalid webhook signature', 401);
          return;
        }
      }
    }

    // Extract AWB from Shiprocket webhook
    const awbNumber = webhookData.shipment_id || webhookData.awb_code;

    if (!awbNumber) {
      sendError(res, 'AWB number not found', 400);
      return;
    }

    // Find and sync order
    const shippingLabel = await ShippingLabel.findOne({
      awbNumber,
      status: 'generated',
    }).lean();

    if (!shippingLabel) {
      sendSuccess(res, { status: 'received' }, 'Webhook received');
      return;
    }

    if (!shippingLabel.orderId) {
      sendError(res, 'Order ID not found in shipping label', 400);
      return;
    }
    const syncResult = await syncOrderTracking(shippingLabel.orderId);
    sendSuccess(
      res,
      { status: 'processed', orderId: syncResult.orderId },
      'Webhook processed successfully'
    );
  } catch (error: any) {
    console.error('[SHIPROCKET WEBHOOK] Error:', error);
    sendSuccess(res, { status: 'received' }, 'Webhook received');
  }
};

/**
 * POST /api/webhooks/courier/delhivery
 * Handle Delhivery webhook (specific endpoint)
 */
export const handleDelhiveryWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['x-delhivery-signature'] as string;
    const webhookData = req.body;

    // Find courier by provider
    const courier = await Courier.findOne({
      'apiConfig.provider': 'delhivery',
      'apiConfig.enabled': true,
    }).lean();

    if (!courier) {
      sendError(res, 'Delhivery courier not configured', 404);
      return;
    }

    // Verify signature if webhook secret is configured
    if (courier.apiConfig?.webhookSecret && signature) {
      const apiClient = createCourierApiClient(courier.apiConfig);
      if (apiClient) {
        const isValid = apiClient.verifyWebhookSignature(JSON.stringify(webhookData), signature);
        if (!isValid) {
          sendError(res, 'Invalid webhook signature', 401);
          return;
        }
      }
    }

    // Extract AWB from Delhivery webhook
    const awbNumber = webhookData.waybill || webhookData.awb;

    if (!awbNumber) {
      sendError(res, 'AWB number not found', 400);
      return;
    }

    // Find and sync order
    const shippingLabel = await ShippingLabel.findOne({
      awbNumber,
      status: 'generated',
    }).lean();

    if (!shippingLabel) {
      sendSuccess(res, { status: 'received' }, 'Webhook received');
      return;
    }

    if (!shippingLabel.orderId) {
      sendError(res, 'Order ID not found in shipping label', 400);
      return;
    }
    const syncResult = await syncOrderTracking(shippingLabel.orderId);
    sendSuccess(
      res,
      { status: 'processed', orderId: syncResult.orderId },
      'Webhook processed successfully'
    );
  } catch (error: any) {
    console.error('[DELHIVERY WEBHOOK] Error:', error);
    sendSuccess(res, { status: 'received' }, 'Webhook received');
  }
};

