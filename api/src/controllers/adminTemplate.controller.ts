import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StoreTemplate } from '../models/StoreTemplate';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { logAudit } from '../utils/auditLogger';
import { AuditActions } from '../constants/domain';

const createSchema = z.object({
  name: z.string().min(2),
  version: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  config: z.any(),
});

export const createTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can create templates', 403);
      return;
    }

    const data = createSchema.parse(req.body);

    if (data.isDefault) {
      // Unset existing default
      await StoreTemplate.updateMany({ isDefault: true }, { isDefault: false });
    }

    const doc = new StoreTemplate({
      name: data.name,
      version: data.version,
      description: data.description || '',
      isDefault: data.isDefault || false,
      config: data.config || {},
      status: 'active',
    });
    await doc.save();

    await logAudit({
      req,
      action: AuditActions.TEMPLATE_CREATED,
      entityType: 'StoreTemplate',
      entityId: doc._id.toString(),
      after: doc.toObject(),
      description: `Template created (${doc.name} ${doc.version})`,
      metadata: { templateId: doc._id.toString(), version: doc.version },
    });

    sendSuccess(res, { template: doc }, 'Template created', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

export const listTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const templates = await StoreTemplate.find().sort({ createdAt: -1 }).lean();
    sendSuccess(res, { templates }, 'Templates fetched');
  } catch (error) {
    next(error);
  }
};

export const getTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await StoreTemplate.findById(id).lean();
    if (!template) {
      sendError(res, 'Template not found', 404);
      return;
    }
    sendSuccess(res, { template }, 'Template fetched');
  } catch (error) {
    next(error);
  }
};

export const disableTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can disable templates', 403);
      return;
    }

    const { id } = req.params;
    const template = await StoreTemplate.findById(id);
    if (!template) {
      sendError(res, 'Template not found', 404);
      return;
    }

    template.status = 'inactive';
    template.isDefault = false;
    await template.save();

    await logAudit({
      req,
      action: AuditActions.TEMPLATE_VERSIONED,
      entityType: 'StoreTemplate',
      entityId: template._id.toString(),
      before: null,
      after: template.toObject(),
      description: `Template disabled (version closed)`,
      metadata: { templateId: template._id.toString(), version: template.version },
    });

    sendSuccess(res, { template }, 'Template disabled');
  } catch (error) {
    next(error);
  }
};


