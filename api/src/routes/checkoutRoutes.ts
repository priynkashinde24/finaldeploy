import { Router } from 'express';
import { createPaymentIntent } from '../controllers/checkoutController';

const router = Router();

// POST /api/checkout/create-payment-intent - Create payment intent and order
router.post('/create-payment-intent', createPaymentIntent);

export default router;

