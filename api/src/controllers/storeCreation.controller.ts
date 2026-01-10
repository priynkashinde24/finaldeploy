import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateStore } from '../services/storeGenerator.service';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Store } from '../models/Store';

const createSchema = z.object({
  storeName: z.string().min(2, 'Store name is required'),
  subdomain: z.string().regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase, numbers and hyphens'),
  planId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
});

export const createStoreOneClick = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const data = createSchema.parse(req.body);

    // Enforce simple plan limit: trial users (no planId) can have only 1 store
    // In local/dev we allow multiple stores to avoid blocking testing.
    if (process.env.NODE_ENV === 'production') {
      const existingCount = await Store.countDocuments({ ownerId: currentUser.id });
      if (!data.planId && existingCount >= 1) {
        sendError(res, 'Trial limit reached. Please upgrade your plan to create more stores.', 403);
        return;
      }
    }

    const store = await generateStore({
      ownerId: currentUser.id,
      storeName: data.storeName,
      subdomain: data.subdomain,
      planId: data.planId || null,
      templateId: data.templateId || null,
    });

    sendSuccess(res, { store }, 'Store created successfully');
  } catch (error) {
    next(error);
  }
};


