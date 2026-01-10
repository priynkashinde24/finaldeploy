import { Router } from 'express';
import { getInvoicesByOrderId } from '../controllers/invoice.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// GET /api/invoices/:orderId - Get invoice data for an order (authenticated users)
router.get('/:orderId', authenticate, getInvoicesByOrderId);

export default router;

