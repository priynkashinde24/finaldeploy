import mongoose from 'mongoose';
import { Reservation } from '../models/Reservation';
import { ResellerProduct } from '../models/ResellerProduct';
import { logAudit } from '../utils/auditLogger';

/**
 * Reservation Service
 * 
 * PURPOSE:
 * - Manage inventory reservations during checkout
 * - Prevent overselling in multi-reseller marketplace
 * - Handle reservation lifecycle: create, extend, confirm, release
 */

export interface CreateReservationParams {
  storeId: mongoose.Types.ObjectId | string;
  cartId: string;
  resellerProductId: mongoose.Types.ObjectId | string;
  quantity: number;
  customerId?: mongoose.Types.ObjectId | string;
  expiresInMinutes?: number; // Default: 15 minutes
  metadata?: Record<string, any>;
}

export interface ReservationResult {
  success: boolean;
  reservation?: any;
  error?: string;
  availableStock?: number;
}

/**
 * Calculate available stock (syncedStock - reservedQuantity)
 */
export async function getAvailableStock(
  resellerProductId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<number> {
  const resellerProduct = await ResellerProduct.findById(resellerProductId);
  if (!resellerProduct) {
    return 0;
  }

  // Apply store filter if provided
  if (options.storeId) {
    const storeId = typeof options.storeId === 'string'
      ? new mongoose.Types.ObjectId(options.storeId)
      : options.storeId;
    if (resellerProduct.storeId.toString() !== storeId.toString()) {
      return 0;
    }
  }

  // Get total reserved quantity (active reservations only)
  const totalReserved = await Reservation.aggregate([
    {
      $match: {
        resellerProductId: typeof resellerProductId === 'string'
          ? new mongoose.Types.ObjectId(resellerProductId)
          : resellerProductId,
        status: 'reserved',
        expiresAt: { $gt: new Date() }, // Not expired
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$quantity' },
      },
    },
  ]);

  const reservedQuantity = totalReserved.length > 0 ? totalReserved[0].total : 0;
  const availableStock = Math.max(0, resellerProduct.syncedStock - reservedQuantity);

  return availableStock;
}

/**
 * Create or update reservation
 */
export async function createReservation(
  params: CreateReservationParams
): Promise<ReservationResult> {
  try {
    const {
      storeId,
      cartId,
      resellerProductId,
      quantity,
      customerId,
      expiresInMinutes = 15,
      metadata = {},
    } = params;

    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    const resellerProductObjId = typeof resellerProductId === 'string'
      ? new mongoose.Types.ObjectId(resellerProductId)
      : resellerProductId;
    const customerObjId = customerId
      ? (typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId)
      : null;

    // Check available stock
    const availableStock = await getAvailableStock(resellerProductId, { storeId });
    if (availableStock < quantity) {
      return {
        success: false,
        error: `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
        availableStock,
      };
    }

    // Check if reseller product exists and is active
    const resellerProduct = await ResellerProduct.findById(resellerProductObjId);
    if (!resellerProduct) {
      return {
        success: false,
        error: 'Reseller product not found',
      };
    }

    if (!resellerProduct.isActive) {
      return {
        success: false,
        error: 'Reseller product is not active',
      };
    }

    // Check store match
    if (resellerProduct.storeId.toString() !== storeObjId.toString()) {
      return {
        success: false,
        error: 'Store ID mismatch',
      };
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Use findOneAndUpdate with upsert for atomic operation
    const reservation = await Reservation.findOneAndUpdate(
      {
        storeId: storeObjId,
        cartId,
        resellerProductId: resellerProductObjId,
        status: 'reserved',
      },
      {
        $set: {
          storeId: storeObjId,
          cartId,
          resellerProductId: resellerProductObjId,
          quantity,
          status: 'reserved',
          expiresAt,
          customerId: customerObjId,
          metadata,
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    // Audit log
    await logAudit({
      storeId: storeObjId.toString(),
      actorRole: 'system',
      action: 'RESERVATION_CREATED',
      entityType: 'Reservation',
      entityId: reservation._id.toString(),
      after: {
        cartId,
        resellerProductId: resellerProductObjId.toString(),
        quantity,
        expiresAt,
        availableStock,
      },
      description: `Reservation created for ${quantity} units`,
      metadata: {
        customerId: customerObjId?.toString() || null,
      },
    });

    return {
      success: true,
      reservation,
      availableStock: availableStock - quantity,
    };
  } catch (error: any) {
    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return {
        success: false,
        error: 'Reservation already exists for this cart and product',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to create reservation',
    };
  }
}

/**
 * Extend reservation expiration
 */
export async function extendReservation(
  reservationId: mongoose.Types.ObjectId | string,
  additionalMinutes: number = 15,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<ReservationResult> {
  try {
    const reservationObjId = typeof reservationId === 'string'
      ? new mongoose.Types.ObjectId(reservationId)
      : reservationId;

    const filter: any = { _id: reservationObjId, status: 'reserved' };
    if (options.storeId) {
      filter.storeId = typeof options.storeId === 'string'
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
    }

    const reservation = await Reservation.findOne(filter);
    if (!reservation) {
      return {
        success: false,
        error: 'Reservation not found or already processed',
      };
    }

    // Extend expiration
    const newExpiresAt = new Date(reservation.expiresAt);
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + additionalMinutes);

    reservation.expiresAt = newExpiresAt;
    await reservation.save();

    return {
      success: true,
      reservation,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to extend reservation',
    };
  }
}

/**
 * Confirm reservation (convert to order)
 */
export async function confirmReservation(
  reservationId: mongoose.Types.ObjectId | string,
  orderId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<ReservationResult> {
  try {
    const reservationObjId = typeof reservationId === 'string'
      ? new mongoose.Types.ObjectId(reservationId)
      : reservationId;
    const orderObjId = typeof orderId === 'string'
      ? new mongoose.Types.ObjectId(orderId)
      : orderId;

    const filter: any = { _id: reservationObjId, status: 'reserved' };
    if (options.storeId) {
      filter.storeId = typeof options.storeId === 'string'
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
    }

    const reservation = await Reservation.findOne(filter);
    if (!reservation) {
      return {
        success: false,
        error: 'Reservation not found or already processed',
      };
    }

    // Check if reservation is expired
    if (reservation.expiresAt < new Date()) {
      reservation.status = 'expired';
      await reservation.save();
      return {
        success: false,
        error: 'Reservation has expired',
      };
    }

    // Confirm reservation
    reservation.status = 'confirmed';
    reservation.confirmedAt = new Date();
    reservation.orderId = orderObjId;
    await reservation.save();

    // Audit log
    await logAudit({
      storeId: reservation.storeId.toString(),
      actorRole: 'system',
      action: 'RESERVATION_CONFIRMED',
      entityType: 'Reservation',
      entityId: reservation._id.toString(),
      before: { status: 'reserved' },
      after: { status: 'confirmed', orderId: orderObjId.toString() },
      description: `Reservation confirmed for order ${orderId}`,
    });

    return {
      success: true,
      reservation,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to confirm reservation',
    };
  }
}

/**
 * Release reservation (cancel or timeout)
 */
export async function releaseReservation(
  reservationId: mongoose.Types.ObjectId | string,
  reason: 'cancelled' | 'expired' | 'manual' = 'cancelled',
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<ReservationResult> {
  try {
    const reservationObjId = typeof reservationId === 'string'
      ? new mongoose.Types.ObjectId(reservationId)
      : reservationId;

    const filter: any = { _id: reservationObjId, status: 'reserved' };
    if (options.storeId) {
      filter.storeId = typeof options.storeId === 'string'
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
    }

    const reservation = await Reservation.findOne(filter);
    if (!reservation) {
      return {
        success: false,
        error: 'Reservation not found or already processed',
      };
    }

    const oldStatus = reservation.status;
    reservation.status = reason === 'expired' ? 'expired' : 'released';
    reservation.releasedAt = new Date();
    await reservation.save();

    // Audit log
    await logAudit({
      storeId: reservation.storeId.toString(),
      actorRole: 'system',
      action: 'RESERVATION_RELEASED',
      entityType: 'Reservation',
      entityId: reservation._id.toString(),
      before: { status: oldStatus },
      after: { status: reservation.status, reason },
      description: `Reservation ${reason}`,
    });

    return {
      success: true,
      reservation,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to release reservation',
    };
  }
}

/**
 * Release all reservations for a cart
 */
export async function releaseCartReservations(
  cartId: string,
  reason: 'cancelled' | 'expired' | 'manual' = 'cancelled',
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<{ released: number; errors: string[] }> {
  const result = { released: 0, errors: [] as string[] };

  try {
    const filter: any = { cartId, status: 'reserved' };
    if (options.storeId) {
      filter.storeId = typeof options.storeId === 'string'
        ? new mongoose.Types.ObjectId(options.storeId)
        : options.storeId;
    }

    const reservations = await Reservation.find(filter);
    
    for (const reservation of reservations) {
      const releaseResult = await releaseReservation(reservation._id, reason, options);
      if (releaseResult.success) {
        result.released++;
      } else {
        result.errors.push(`Reservation ${reservation._id}: ${releaseResult.error}`);
      }
    }

    return result;
  } catch (error: any) {
    result.errors.push(error.message || 'Failed to release cart reservations');
    return result;
  }
}

/**
 * Get reservations for a cart
 */
export async function getCartReservations(
  cartId: string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<any[]> {
  const filter: any = { cartId, status: 'reserved' };
  if (options.storeId) {
    filter.storeId = typeof options.storeId === 'string'
      ? new mongoose.Types.ObjectId(options.storeId)
      : options.storeId;
  }

  return await Reservation.find(filter)
    .populate('resellerProductId', 'globalProductId resellerPrice supplierCost')
    .lean();
}

/**
 * Confirm all reservations for a cart (when order is created)
 */
export async function confirmCartReservations(
  cartId: string,
  orderId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<{ confirmed: number; errors: string[] }> {
  const result = { confirmed: 0, errors: [] as string[] };

  try {
    const reservations = await getCartReservations(cartId, options);
    
    for (const reservation of reservations) {
      const confirmResult = await confirmReservation(reservation._id, orderId, options);
      if (confirmResult.success) {
        result.confirmed++;
      } else {
        result.errors.push(`Reservation ${reservation._id}: ${confirmResult.error}`);
      }
    }

    return result;
  } catch (error: any) {
    result.errors.push(error.message || 'Failed to confirm cart reservations');
    return result;
  }
}

