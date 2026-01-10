import { Router } from 'express';
import {
  createReservationController,
  getAvailableStockController,
  getCartReservationsController,
  extendReservationController,
  releaseReservationController,
  releaseCartReservationsController,
} from '../controllers/reservation.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require store context and authentication
router.use(resolveStore);
router.use(authenticate);

// POST /api/reservations - Create reservation
router.post('/', authorize(['reseller', 'admin', 'customer']), createReservationController);

// GET /api/reservations/stock/:resellerProductId - Get available stock
router.get('/stock/:resellerProductId', authorize(['reseller', 'admin', 'customer']), getAvailableStockController);

// GET /api/reservations/cart/:cartId - Get cart reservations
router.get('/cart/:cartId', authorize(['reseller', 'admin', 'customer']), getCartReservationsController);

// PATCH /api/reservations/:id/extend - Extend reservation
router.patch('/:id/extend', authorize(['reseller', 'admin', 'customer']), extendReservationController);

// DELETE /api/reservations/:id - Release reservation
router.delete('/:id', authorize(['reseller', 'admin', 'customer']), releaseReservationController);

// DELETE /api/reservations/cart/:cartId - Release all cart reservations
router.delete('/cart/:cartId', authorize(['reseller', 'admin', 'customer']), releaseCartReservationsController);

export default router;

