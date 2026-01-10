import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { SupplierVariantInventory } from '../models/SupplierVariantInventory';
import { ResellerVariantInventory } from '../models/ResellerVariantInventory';
import { InventoryReservation } from '../models/InventoryReservation';
import { authenticate, authorize } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

/**
 * Inventory Visibility Controller
 * 
 * PURPOSE:
 * - Supplier UI: View variant stock, reserved vs available, recent reservations
 * - Admin UI: Inventory health, oversell attempts, sync delays
 */

/**
 * GET /api/inventory/supplier/variants
 * Get supplier's variant inventory (Supplier only)
 */
export const getSupplierVariantInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'supplier' || !storeId) {
      sendError(res, 'Only suppliers can view their inventory', 403);
      return;
    }

    const supplierInventories = await SupplierVariantInventory.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      supplierId: new mongoose.Types.ObjectId(currentUser.id),
    })
      .populate('globalVariantId', 'sku attributes')
      .lean();

    // Calculate summary
    const summary = {
      totalVariants: supplierInventories.length,
      totalStock: supplierInventories.reduce((sum, inv) => sum + inv.totalStock, 0),
      availableStock: supplierInventories.reduce((sum, inv) => sum + inv.availableStock, 0),
      reservedStock: supplierInventories.reduce((sum, inv) => sum + inv.reservedStock, 0),
      outOfStock: supplierInventories.filter((inv) => inv.availableStock === 0).length,
    };

    sendSuccess(
      res,
      {
        inventories: supplierInventories,
        summary,
      },
      'Supplier inventory fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/supplier/variants/:variantId/reservations
 * Get reservations for a supplier variant (Supplier only)
 */
export const getSupplierVariantReservations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { variantId } = req.params;

    if (!currentUser || currentUser.role !== 'supplier' || !storeId) {
      sendError(res, 'Only suppliers can view reservations', 403);
      return;
    }

    const reservations = await InventoryReservation.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      supplierId: new mongoose.Types.ObjectId(currentUser.id),
      globalVariantId: new mongoose.Types.ObjectId(variantId),
      status: 'reserved',
    })
      .populate('orderId', 'orderId status')
      .populate('globalVariantId', 'sku attributes')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    sendSuccess(res, { reservations }, 'Reservations fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/admin/health
 * Get inventory health metrics (Admin only)
 */
export const getInventoryHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Only admins can view inventory health', 403);
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    // Get supplier inventory stats
    const supplierInventories = await SupplierVariantInventory.find({ storeId: storeObjId }).lean();
    const totalSupplierStock = supplierInventories.reduce((sum, inv) => sum + inv.totalStock, 0);
    const totalReservedStock = supplierInventories.reduce((sum, inv) => sum + inv.reservedStock, 0);
    const outOfStockVariants = supplierInventories.filter((inv) => inv.availableStock === 0).length;

    // Get reseller inventory stats
    const resellerInventories = await ResellerVariantInventory.find({ storeId: storeObjId }).lean();
    const staleSyncCount = resellerInventories.filter((inv) => {
      const hoursSinceSync = (Date.now() - new Date(inv.lastSyncedAt).getTime()) / (1000 * 60 * 60);
      return hoursSinceSync > 24; // Stale if not synced in 24 hours
    }).length;

    // Get active reservations
    const activeReservations = await InventoryReservation.countDocuments({
      storeId: storeObjId,
      status: 'reserved',
    });

    // Get expired reservations (potential oversell attempts)
    const expiredReservations = await InventoryReservation.countDocuments({
      storeId: storeObjId,
      status: 'reserved',
      expiresAt: { $lt: new Date() },
    });

    const health = {
      supplierInventory: {
        totalVariants: supplierInventories.length,
        totalStock: totalSupplierStock,
        availableStock: totalSupplierStock - totalReservedStock,
        reservedStock: totalReservedStock,
        outOfStockVariants,
        utilizationRate: totalSupplierStock > 0 ? (totalReservedStock / totalSupplierStock) * 100 : 0,
      },
      resellerInventory: {
        totalViews: resellerInventories.length,
        staleSyncCount,
        syncHealth: staleSyncCount === 0 ? 'healthy' : staleSyncCount < 10 ? 'warning' : 'critical',
      },
      reservations: {
        active: activeReservations,
        expired: expiredReservations,
        health: expiredReservations === 0 ? 'healthy' : expiredReservations < 5 ? 'warning' : 'critical',
      },
    };

    sendSuccess(res, { health }, 'Inventory health fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/admin/oversell-attempts
 * Get oversell attempts (Admin only)
 */
export const getOversellAttempts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'admin' || !storeId) {
      sendError(res, 'Only admins can view oversell attempts', 403);
      return;
    }

    // This would typically come from audit logs or error tracking
    // For now, we'll return expired reservations as potential oversell indicators
    const expiredReservations = await InventoryReservation.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      status: 'reserved',
      expiresAt: { $lt: new Date() },
    })
      .populate('globalVariantId', 'sku')
      .populate('orderId', 'orderId')
      .sort({ expiresAt: -1 })
      .limit(100)
      .lean();

    sendSuccess(
      res,
      {
        attempts: expiredReservations.map((r) => ({
          variantId: r.globalVariantId,
          orderId: r.orderId,
          quantity: r.quantity,
          expiredAt: r.expiresAt,
        })),
        count: expiredReservations.length,
      },
      'Oversell attempts fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

