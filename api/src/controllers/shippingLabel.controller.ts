import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { ShippingLabel, IShippingLabel } from '../models/ShippingLabel';
import { Order } from '../models/Order';
import { generateShippingLabel, getShippingLabel } from '../services/shippingLabel.service';
import { logAudit } from '../utils/auditLogger';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

/**
 * Shipping Label Controller
 * 
 * PURPOSE:
 * - Generate shipping labels for orders
 * - Download label PDFs
 * - Admin, Supplier, Reseller access
 */

/**
 * POST /orders/:id/shipping-label
 * Generate shipping label for an order
 */
export const generateLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Check permissions: Admin, Supplier (own orders), Reseller (own store)
    const userRole = currentUser.role;
    if (!['admin', 'supplier', 'reseller'].includes(userRole)) {
      sendError(res, 'Access denied', 403);
      return;
    }

    const orderObjId = new mongoose.Types.ObjectId(id);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Verify order exists and belongs to store
    const order = await Order.findOne({
      _id: orderObjId,
      storeId: storeObjId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Supplier can only generate labels for their own orders
    if (userRole === 'supplier' && order.supplierId) {
      const supplierObjId = typeof order.supplierId === 'string' 
        ? new mongoose.Types.ObjectId(order.supplierId) 
        : order.supplierId;
      if (supplierObjId.toString() !== currentUser.id) {
        sendError(res, 'Access denied: You can only generate labels for your own orders', 403);
        return;
      }
    }

    // Generate label
    const result = await generateShippingLabel({
      orderId: orderObjId,
      generatedBy: currentUser.id,
      req,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to generate shipping label', 400);
      return;
    }

    sendSuccess(res, { label: result.label }, 'Shipping label generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /shipping-labels/:id/download
 * Download shipping label PDF
 */
export const downloadLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params; // labelNumber or labelId

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Check permissions
    const userRole = currentUser.role;
    if (!['admin', 'supplier', 'reseller'].includes(userRole)) {
      sendError(res, 'Access denied', 403);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Find label by labelNumber or _id
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const label = await ShippingLabel.findOne({
      $or: [
        { labelNumber: id },
        ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(id) }] : []),
      ],
      storeId: storeObjId,
      status: 'generated',
    }).populate('orderId', 'orderNumber supplierId');

    if (!label) {
      sendError(res, 'Shipping label not found', 404);
      return;
    }

    // Supplier can only download labels for their own orders
    if (userRole === 'supplier' && (label.orderId as any)?.supplierId) {
      const order = label.orderId as any;
      const supplierObjId = typeof order.supplierId === 'string'
        ? new mongoose.Types.ObjectId(order.supplierId)
        : order.supplierId;
      if (supplierObjId.toString() !== currentUser.id) {
        sendError(res, 'Access denied: You can only download labels for your own orders', 403);
        return;
      }
    }

    // Get PDF file path
    const tempDir = path.join(process.cwd(), 'temp', 'labels');
    const pdfPath = path.join(tempDir, `${label.labelNumber}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      sendError(res, 'PDF file not found', 404);
      return;
    }

    // Audit log
    await logAudit({
      req,
      action: 'SHIPPING_LABEL_DOWNLOADED',
      entityType: 'ShippingLabel',
      entityId: label._id.toString(),
      description: `Shipping label downloaded: ${label.labelNumber}`,
      metadata: {
        labelNumber: label.labelNumber,
        orderId: label.orderId ? ((label.orderId as any)?.orderNumber || label.orderId.toString()) : undefined,
      },
    });

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${label.labelNumber}.pdf"`);
    res.sendFile(pdfPath);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /orders/:id/shipping-label
 * Get shipping label for an order
 */
export const getLabelForOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const orderObjId = new mongoose.Types.ObjectId(id);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Verify order exists
    const order = await Order.findOne({
      _id: orderObjId,
      storeId: storeObjId,
    });

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    // Get label
    const label = await getShippingLabel(orderObjId);

    if (!label) {
      sendError(res, 'Shipping label not found for this order', 404);
      return;
    }

    sendSuccess(res, { label }, 'Shipping label retrieved successfully');
  } catch (error) {
    next(error);
  }
};

