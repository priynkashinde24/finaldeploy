import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { GeoHeatmapSnapshot } from '../models/GeoHeatmapSnapshot';
import { InventoryAgingSnapshot } from '../models/InventoryAgingSnapshot';
import { PriceSensitivitySnapshot } from '../models/PriceSensitivitySnapshot';
import { SKURecommendation } from '../models/SKURecommendation';
import { Order } from '../models/Order';
import { RMA } from '../models/RMA';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Advanced Analytics Controller
 * 
 * Combines:
 * - Geo Heatmaps (state/pincode sales)
 * - Inventory Aging (slow-moving stock)
 * - Price Sensitivity (demand elasticity)
 * - AI SKU Recommendations
 */

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
});

function getScopeAndEntity(user: any, storeId?: mongoose.Types.ObjectId | string): {
  scope: 'admin' | 'supplier' | 'reseller';
  entityId: mongoose.Types.ObjectId | string | null;
} {
  if (!user) throw new Error('User not authenticated');
  const userRole = user.role;
  if (userRole === 'admin') return { scope: 'admin', entityId: null };
  if (userRole === 'reseller') {
    const resellerId = user.id?.toString() || storeId?.toString() || '';
    return { scope: 'reseller', entityId: resellerId };
  }
  if (userRole === 'supplier') {
    const supplierId = user.id?.toString() || '';
    return { scope: 'supplier', entityId: supplierId ? new mongoose.Types.ObjectId(supplierId) : null };
  }
  throw new Error('Invalid user role');
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /analytics/geo/heatmap
 * Get geographic heatmap data
 */
export const getGeoHeatmap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);
    const { startDate, endDate, locationType = 'state' } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    try {
      dateRangeSchema.parse({ startDate: start, endDate: end });
    } catch (error: any) {
      sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      return;
    }

    const query: any = {
      storeId,
      scope,
      locationType,
      date: { $gte: start, $lte: end },
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const snapshots = await GeoHeatmapSnapshot.find(query).lean();
    const locationMap = new Map<string, any>();

    for (const snapshot of snapshots) {
      const key = snapshot.locationValue;
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          locationType: snapshot.locationType,
          locationValue: snapshot.locationValue,
          country: snapshot.country,
          state: snapshot.state,
          city: snapshot.city,
          pincode: snapshot.pincode,
          ordersCount: 0,
          grossRevenue: 0,
          averageOrderValue: 0,
          returnRate: 0,
        });
      }

      const data = locationMap.get(key)!;
      data.ordersCount += snapshot.ordersCount || 0;
      data.grossRevenue += snapshot.grossRevenue || 0;
    }

    const heatmapData = Array.from(locationMap.values()).map((data) => {
      data.averageOrderValue = data.ordersCount > 0 ? data.grossRevenue / data.ordersCount : 0;
      return data;
    });

    await logAudit({
      action: 'GEO_HEATMAP_VIEWED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'geo_heatmap',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'Geo heatmap viewed',
      metadata: { scope, locationType, dateRange: { start, end } },
    });

    sendSuccess(res, { heatmap: heatmapData, locationType, dateRange: { start, end } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/inventory/aging
 * Get inventory aging heatmap
 */
export const getInventoryAging = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);
    const { date } = req.query;
    const snapshotDate = (date as string) || formatDate(new Date());

    const query: any = {
      storeId,
      scope,
      date: snapshotDate,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const snapshots = await InventoryAgingSnapshot.find(query)
      .sort({ daysSinceLastSale: -1 })
      .lean();

    await logAudit({
      action: 'INVENTORY_AGING_VIEWED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'inventory_aging',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'Inventory aging viewed',
      metadata: { scope, date: snapshotDate },
    });

    sendSuccess(res, { aging: snapshots, date: snapshotDate });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/price/sensitivity
 * Get price sensitivity analysis
 */
export const getPriceSensitivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);
    const { startDate, endDate } = req.query;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const start = (startDate as string) || yesterday;
    const end = (endDate as string) || today;

    try {
      dateRangeSchema.parse({ startDate: start, endDate: end });
    } catch (error: any) {
      sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      return;
    }

    const query: any = {
      storeId,
      scope,
      date: { $gte: start, $lte: end },
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const snapshots = await PriceSensitivitySnapshot.find(query).sort({ date: -1 }).lean();

    await logAudit({
      action: 'PRICE_SENSITIVITY_VIEWED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'price_sensitivity',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'Price sensitivity viewed',
      metadata: { scope, dateRange: { start, end } },
    });

    sendSuccess(res, { sensitivity: snapshots, dateRange: { start, end } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /analytics/sku/recommendations
 * Get AI SKU recommendations
 */
export const getSKURecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);
    const { type, status = 'pending', limit = 50 } = req.query;

    const query: any = {
      storeId,
      scope,
      status: status as string,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    if (type) query.recommendationType = type;

    const recommendations = await SKURecommendation.find(query)
      .sort({ priority: -1, confidence: -1 })
      .limit(Number(limit))
      .lean();

    await logAudit({
      action: 'SKU_RECOMMENDATIONS_VIEWED',
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'system',
      entityType: 'sku_recommendations',
      entityId: new mongoose.Types.ObjectId(storeId),
      description: 'SKU recommendations viewed',
      metadata: { scope, type, status },
    });

    sendSuccess(res, { recommendations });
  } catch (error: any) {
    next(error);
  }
};

