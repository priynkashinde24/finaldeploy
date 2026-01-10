import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Reseller Orders Controller
 * 
 * PURPOSE:
 * - Reseller can view orders from their stores
 * - Filter by status, date range, search
 * - View order details
 */

const ordersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orderStatus: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'cod_pending', 'cod_collected', 'cod_failed', 'cod_partial_paid']).optional(),
  q: z.string().optional(),
});

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /reseller/orders
 * Get reseller's orders with filters and pagination
 */
export const getResellerOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view orders', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const parsed = ordersQuerySchema.parse({
      page: req.query.page,
      limit: req.query.limit,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      orderStatus: req.query.orderStatus,
      paymentStatus: req.query.paymentStatus,
      q: req.query.q,
    });

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    // Build match query - filter by storeId and resellerId
    const match: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: currentUser.id.toString(), // Filter by reseller ID
      createdAt: {
        $gte: new Date(`${start}T00:00:00.000Z`),
        $lte: new Date(`${end}T23:59:59.999Z`),
      },
    };

    if (parsed.orderStatus) match.orderStatus = parsed.orderStatus;
    if (parsed.paymentStatus) match.paymentStatus = parsed.paymentStatus;
    if (parsed.q) {
      const regex = new RegExp(parsed.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [
        { orderNumber: regex },
        { orderId: regex },
        { customerEmail: regex },
        { customerName: regex },
      ];
    }

    const skip = (parsed.page - 1) * parsed.limit;

    // Aggregate query for pagination
    const [result] = await Order.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: parsed.limit },
            {
              $project: {
                _id: 1,
                orderId: 1,
                orderNumber: 1,
                customerName: 1,
                customerEmail: 1,
                orderStatus: 1,
                paymentStatus: 1,
                paymentMethod: 1,
                grandTotal: { $ifNull: ['$totalAmountWithTax', '$grandTotal', '$totalAmount'] },
                subtotal: { $ifNull: ['$subtotal', '$totalAmount'] },
                taxTotal: { $ifNull: ['$taxTotal', '$taxAmount', 0] },
                discountAmount: { $ifNull: ['$discountAmount', 0] },
                shippingAmount: { $ifNull: ['$shippingAmount', 0] },
                itemsCount: { $size: { $ifNull: ['$items', []] } },
                createdAt: 1,
                updatedAt: 1,
                shippingAddress: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const items = result?.items || [];
    const total = result?.total?.[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsed.limit));

    sendSuccess(res, {
      orders: items,
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total,
        totalPages,
      },
      dateRange: { start, end },
    }, 'Orders fetched successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'Invalid query parameters', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reseller/orders/:id
 * Get single order details
 */
export const getResellerOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const orderId = req.params.id;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view orders', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    // Find order by orderId or orderNumber, matching store and reseller
    const order = await Order.findOne({
      $or: [
        { orderId },
        { orderNumber: orderId },
      ],
      storeId: new mongoose.Types.ObjectId(storeId),
      resellerId: currentUser.id.toString(),
    })
      .populate('customerId', 'name email')
      .lean();

    if (!order) {
      sendError(res, 'Order not found', 404);
      return;
    }

    sendSuccess(res, { order }, 'Order fetched successfully');
  } catch (error) {
    next(error);
  }
};

