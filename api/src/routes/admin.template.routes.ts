import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createTemplate, listTemplates, getTemplate, disableTemplate } from '../controllers/adminTemplate.controller';

const router = Router();

router.use(authenticate);
router.use(authorize(['admin']));

router.post('/store-templates', createTemplate);
router.get('/store-templates', listTemplates);
router.get('/store-templates/:id', getTemplate);
router.patch('/store-templates/:id/disable', disableTemplate);

export default router;


