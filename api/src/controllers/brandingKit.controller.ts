import { Request, Response, NextFunction } from 'express';
import { getActiveBrandingKit } from '../services/brandingKit.service';

export const getActiveBrandingHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).store?.storeId;
    if (!storeId) {
      // No store resolved — return null branding so frontend can fall back to defaults
      return res.json({ data: { branding: null } });
    }
    const branding = await getActiveBrandingKit(storeId);
    res.json({ data: { branding } });
  } catch (err) {
    next(err);
  }
};


