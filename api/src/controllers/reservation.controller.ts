import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  createReservation,
  getAvailableStock,
  extendReservation,
  releaseReservation,
  getCartReservations,
  releaseCartReservations,
} from '../services/reservation.service';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';

// Validation schemas
const createReservationSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  resellerProductId: z.string().min(1, 'Reseller product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  expiresInMinutes: z.number().int().min(1).max(60).optional(),
});

const extendReservationSchema = z.object({
  additionalMinutes: z.number().int().min(1).max(60),
});

/**
 * Reservation Controller
 * 
 * PURPOSE:
 * - Manage inventory reservations
 * - Prevent overselling
 * - Support checkout flow
 */

/**
 * POST /reservations
 * Create reservation
 */
export const createReservationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const customerId = req.user?.id;

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const validatedData = createReservationSchema.parse(req.body);

    const result = await createReservation({
      storeId,
      cartId: validatedData.cartId,
      resellerProductId: validatedData.resellerProductId,
      quantity: validatedData.quantity,
      customerId: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
      expiresInMinutes: validatedData.expiresInMinutes || 15,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to create reservation', 400);
      return;
    }

    sendSuccess(res, { reservation: result.reservation, availableStock: result.availableStock }, 'Reservation created successfully', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reservations/stock/:resellerProductId
 * Get available stock (accounting for reservations)
 */
export const getAvailableStockController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { resellerProductId } = req.params;

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const availableStock = await getAvailableStock(resellerProductId, { storeId });

    sendSuccess(res, { availableStock, resellerProductId }, 'Available stock fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /reservations/cart/:cartId
 * Get reservations for a cart
 */
export const getCartReservationsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { cartId } = req.params;

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const reservations = await getCartReservations(cartId, { storeId });

    sendSuccess(res, { reservations }, 'Reservations fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /reservations/:id/extend
 * Extend reservation expiration
 */
export const extendReservationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const validatedData = extendReservationSchema.parse(req.body);

    const result = await extendReservation(id, validatedData.additionalMinutes, { storeId });

    if (!result.success) {
      sendError(res, result.error || 'Failed to extend reservation', 400);
      return;
    }

    sendSuccess(res, { reservation: result.reservation }, 'Reservation extended successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * DELETE /reservations/:id
 * Release reservation
 */
export const releaseReservationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { id } = req.params;

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const result = await releaseReservation(id, 'manual', { storeId });

    if (!result.success) {
      sendError(res, result.error || 'Failed to release reservation', 400);
      return;
    }

    sendSuccess(res, { reservation: result.reservation }, 'Reservation released successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /reservations/cart/:cartId
 * Release all reservations for a cart
 */
export const releaseCartReservationsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = req.store?.storeId;
    const { cartId } = req.params;

    if (!storeId) {
      sendError(res, 'Store ID is required', 400);
      return;
    }

    const result = await releaseCartReservations(cartId, 'cancelled', { storeId });

    sendSuccess(res, { released: result.released, errors: result.errors }, 'Cart reservations released successfully');
  } catch (error) {
    next(error);
  }
};

