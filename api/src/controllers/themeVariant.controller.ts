import { Request, Response, NextFunction } from 'express';
import { getActiveTheme, listThemeVariants, applyThemeVariant, rollbackThemeVariant, getThemeHistory } from '../services/themeVariant.service';

export const getActiveThemeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).store?.storeId;
    // For public storefront calls, if store is not resolved, just return null theme
    if (!storeId) {
      return res.json({ data: { theme: null } });
    }
    const theme = await getActiveTheme(storeId);
    res.json({ data: { theme } });
  } catch (err) {
    next(err);
  }
};

export const listThemeVariantsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).store?.storeId;
    if (!storeId) return res.status(400).json({ error: 'store_not_resolved' });
    const variants = await listThemeVariants(storeId);
    res.json({ data: { variants } });
  } catch (err) {
    next(err);
  }
};

export const applyThemeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).store?.storeId;
    const actorId = (req as any).user?._id;
    const { code } = req.body;
    if (!storeId) return res.status(400).json({ error: 'store_not_resolved' });
    if (!code) return res.status(400).json({ error: 'code_required' });
    const variant = await applyThemeVariant(storeId, code, actorId?.toString(), req);
    res.json({ data: { variant } });
  } catch (err) {
    next(err);
  }
};

export const themeHistoryHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).store?.storeId;
    if (!storeId) return res.status(400).json({ error: 'store_not_resolved' });
    const history = await getThemeHistory(storeId);
    res.json({ data: { history } });
  } catch (err) {
    next(err);
  }
};

export const rollbackThemeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).store?.storeId;
    const actorId = (req as any).user?._id;
    const { version } = req.body;
    if (!storeId) return res.status(400).json({ error: 'store_not_resolved' });
    if (version === undefined) return res.status(400).json({ error: 'version_required' });
    const variant = await rollbackThemeVariant(storeId, Number(version), actorId?.toString(), req);
    res.json({ data: { variant } });
  } catch (err) {
    next(err);
  }
};


