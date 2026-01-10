import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

/**
 * Reseller Customers Controller
 * 
 * PURPOSE:
 * - Reseller can view customers who have placed orders in their stores
 * - Shows customer info, order stats, and order history
 */

const customersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  q: z.string().optional(), // Search by name or email
});

/**
 * GET /reseller/customers
 * Get reseller's customers (from orders)
 */
export const getResellerCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view customers', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const parsed = customersQuerySchema.parse({
      page: req.query.page,
      limit: req.query.limit,
      q: req.query.q,
    });

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const skip = (parsed.page - 1) * parsed.limit;

    // Build match query for orders
    const orderMatch: any = {
      storeId: storeObjId,
      resellerId: currentUser.id.toString(),
    };

    // If search query provided, filter orders by customer name/email
    if (parsed.q) {
      const regex = new RegExp(parsed.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      orderMatch.$or = [
        { customerName: regex },
        { customerEmail: regex },
      ];
    }

    // Aggregate to get unique customers with their order stats
    const [result] = await Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: {
            $cond: [
              { $ne: ['$customerId', null] },
              '$customerId',
              { $concat: ['guest_', { $ifNull: ['$customerEmail', 'unknown'] }] }
            ]
          },
          customerId: { $first: '$customerId' },
          customerName: { $first: '$customerName' },
          customerEmail: { $first: '$customerEmail' },
          orderCount: { $sum: 1 },
          totalSpent: { $sum: { $ifNull: ['$totalAmountWithTax', '$grandTotal', '$totalAmount'] } },
          lastOrderDate: { $max: '$createdAt' },
          firstOrderDate: { $min: '$createdAt' },
          orderIds: { $push: '$orderId' },
        },
      },
      { $sort: { lastOrderDate: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: parsed.limit },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const items = result?.items || [];
    const total = result?.total?.[0]?.count || 0;

    // Populate customer details for logged-in customers
    const customersWithDetails = await Promise.all(
      items.map(async (item: any) => {
        let customerDetails = null;
        
        // If customerId exists and is not a guest, try to get user details
        if (item.customerId && !item._id.toString().startsWith('guest_')) {
          try {
            const user = await User.findById(item.customerId).select('name email phone phoneNumber').lean();
            if (user) {
              customerDetails = {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone || user.phoneNumber,
              };
            }
          } catch (err) {
            // User might not exist, use order data
          }
        }

        return {
          id: item._id.toString(),
          customerId: item.customerId ? item.customerId.toString() : null,
          name: customerDetails?.name || item.customerName || 'Guest Customer',
          email: customerDetails?.email || item.customerEmail || null,
          phone: customerDetails?.phone || null,
          orderCount: item.orderCount,
          totalSpent: item.totalSpent,
          averageOrderValue: item.orderCount > 0 ? item.totalSpent / item.orderCount : 0,
          lastOrderDate: item.lastOrderDate,
          firstOrderDate: item.firstOrderDate,
          isGuest: !item.customerId || item._id.toString().startsWith('guest_'),
        };
      })
    );

    sendSuccess(res, {
      customers: customersWithDetails,
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsed.limit)),
      },
    }, 'Customers fetched successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'Invalid query parameters', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reseller/customers/:id/orders
 * Get orders for a specific customer
 */
export const getCustomerOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const customerId = req.params.id;

    if (!currentUser || currentUser.role !== 'reseller') {
      sendError(res, 'Only resellers can view customer orders', 403);
      return;
    }

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    
    // Build match query
    const match: any = {
      storeId: storeObjId,
      resellerId: currentUser.id.toString(),
    };

    // Check if it's a customer ID or guest email
    if (customerId.startsWith('guest_')) {
      const email = customerId.replace('guest_', '');
      match.customerId = null;
      match.customerEmail = email;
    } else {
      match.customerId = new mongoose.Types.ObjectId(customerId);
    }

    const orders = await Order.find(match)
      .sort({ createdAt: -1 })
      .select('orderId orderNumber orderStatus paymentStatus paymentMethod grandTotal totalAmountWithTax totalAmount createdAt items')
      .lean();

    sendSuccess(res, { orders }, 'Customer orders fetched successfully');
  } catch (error) {
    next(error);
  }
};

