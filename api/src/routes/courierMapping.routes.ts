import { Router } from 'express';
import {
  mapLogisticsCourier,
  mapReturnsCourier,
  mapCRMCourier,
  createMappingRule,
  listMappingRules,
  getAvailableCouriers,
} from '../controllers/courierMapping.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /courier-mapping/logistics - Map courier for logistics
router.post('/logistics', resolveStore, mapLogisticsCourier);

// POST /courier-mapping/returns - Map courier for returns
router.post('/returns', resolveStore, mapReturnsCourier);

// POST /courier-mapping/crm - Map courier for CRM
router.post('/crm', resolveStore, mapCRMCourier);

// GET /courier-mapping/available - Get available couriers
router.get('/available', resolveStore, getAvailableCouriers);

// Admin routes
router.use(authorize(['admin']));

// POST /admin/courier-mapping/rules - Create mapping rule
router.post('/rules', resolveStore, createMappingRule);

// GET /admin/courier-mapping/rules - List mapping rules
router.get('/rules', resolveStore, listMappingRules);

export default router;

