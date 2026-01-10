import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

// Schema for validating order query parameters
const ordersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  orderStatus: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'cod_pending', 'cod_collected', 'cod_failed', 'cod_partial_paid']).optional(),
});

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /customer/orders
 * Get customer's own orders
 */
export const getCustomerOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const parsed = ordersQuerySchema.parse(req.query);

    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = parsed.startDate || thirtyDaysAgo;
    const end = parsed.endDate || today;

    // Build match query - filter by customerId or customerEmail
    const match: any = {
      $or: [
        { customerId: new mongoose.Types.ObjectId(currentUser.id) },
        { customerEmail: currentUser.email },
      ],
      createdAt: {
        $gte: new Date(`${start}T00:00:00.000Z`),
        $lte: new Date(`${end}T23:59:59.999Z`),
      },
    };

    if (parsed.orderStatus) match.orderStatus = parsed.orderStatus;
    if (parsed.paymentStatus) match.paymentStatus = parsed.paymentStatus;

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
                _id: 0,
                id: '$_id',
                orderId: 1,
                orderNumber: 1,
                orderStatus: 1,
                paymentStatus: 1,
                paymentMethod: 1,
                grandTotal: { $ifNull: ['$totalAmountWithTax', '$grandTotal'] },
                subtotal: { $ifNull: ['$totalAmount', '$subtotal'] },
                taxTotal: { $ifNull: ['$taxAmount', '$taxTotal'] },
                discountAmount: { $ifNull: ['$discountAmount', 0] },
                shippingAmount: { $ifNull: ['$shippingAmount', 0] },
                itemsCount: { $size: { $ifNull: ['$items', []] } },
                createdAt: 1,
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

    sendSuccess(
      res,
      {
        orders: items,
        pagination: {
          page: parsed.page,
          limit: parsed.limit,
          total,
          totalPages,
        },
        dateRange: { start, end },
      },
      'Orders fetched successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /customer/orders/:id
 * Get single order details for customer
 */
export const getCustomerOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const orderId = req.params.id;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      sendError(res, 'Invalid order ID', 400);
      return;
    }

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(orderId),
      $or: [
        { customerId: new mongoose.Types.ObjectId(currentUser.id) },
        { customerEmail: currentUser.email },
      ],
    })
      .populate('items.globalProductId', 'name images')
      .populate('items.globalVariantId', 'attributes')
      .lean();

    if (!order) {
      sendError(res, 'Order not found or you do not have permission to view it', 404);
      return;
    }

    sendSuccess(res, { order }, 'Order fetched successfully');
  } catch (error) {
    next(error);
  }
};

