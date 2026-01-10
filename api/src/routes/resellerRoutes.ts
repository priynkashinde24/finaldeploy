import { Router } from 'express';
import {
  addToResellerCatalog,
  removeFromResellerCatalog,
  updateResellerPrice,
} from '../controllers/resellerController';
import {
  getResellerCatalog,
  selectResellerProduct,
  getResellerProducts,
  createResellerProduct,
  updateResellerProduct,
  getAvailableSupplierVariants,
} from '../controllers/resellerProduct.controller';
import { getResellerPayouts } from '../controllers/resellerPayout.controller';
import { getResellerOrders, getResellerOrder } from '../controllers/resellerOrders.controller';
import { getResellerCustomers, getCustomerOrders } from '../controllers/resellerCustomers.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// GET /api/reseller/catalog - Get available supplier products for selection (reseller or admin)
router.get('/catalog', authenticate, authorize(['reseller', 'admin']), getResellerCatalog);

// POST /api/reseller/products/select - Select supplier variant and create reseller product
router.post('/products/select', authenticate, authorize(['reseller']), selectResellerProduct);

// POST /api/reseller/catalog/add - Add product to reseller catalog (reseller or admin)
router.post('/catalog/add', authenticate, authorize(['reseller', 'admin']), addToResellerCatalog);

// PUT /api/reseller/catalog/:id/price - Update reseller price (reseller or admin)
router.put('/catalog/:id/price', authenticate, authorize(['reseller', 'admin']), updateResellerPrice);

// DELETE /api/reseller/catalog/:id - Remove product from catalog (reseller or admin)
router.delete('/catalog/:id', authenticate, authorize(['reseller', 'admin']), removeFromResellerCatalog);

// GET /api/reseller/products - Get reseller's product catalog (new model)
router.get('/products', authenticate, authorize(['reseller']), getResellerProducts);

// GET /api/reseller/products/available - Get available supplier variants grouped by supplier
router.get('/products/available', authenticate, authorize(['reseller']), getAvailableSupplierVariants);

// POST /api/reseller/products - Create reseller product (new model)
router.post('/products', authenticate, authorize(['reseller']), createResellerProduct);

// PATCH /api/reseller/products/:id - Update reseller product (new model)
router.patch('/products/:id', authenticate, authorize(['reseller']), updateResellerProduct);

// GET /api/reseller/payouts - Get reseller's payouts (earnings)
router.get('/payouts', authenticate, authorize(['reseller']), resolveStore, getResellerPayouts);

// GET /api/reseller/orders - Get reseller's orders
router.get('/orders', authenticate, authorize(['reseller']), resolveStore, getResellerOrders);

// GET /api/reseller/orders/:id - Get single order details
router.get('/orders/:id', authenticate, authorize(['reseller']), resolveStore, getResellerOrder);

// GET /api/reseller/customers - Get reseller's customers
router.get('/customers', authenticate, authorize(['reseller']), resolveStore, getResellerCustomers);

// GET /api/reseller/customers/:id/orders - Get orders for a specific customer
router.get('/customers/:id/orders', authenticate, authorize(['reseller']), resolveStore, getCustomerOrders);

export default router;

