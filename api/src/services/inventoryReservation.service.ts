import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { InventoryReservation } from '../models/InventoryReservation';
import { SupplierVariantInventory } from '../models/SupplierVariantInventory';
import { OriginVariantInventory } from '../models/OriginVariantInventory';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';

/**
 * Inventory Reservation Service (Variant-Level)
 * 
 * PURPOSE:
 * - Reserve variant inventory during checkout (transactional)
 * - Prevent overselling
 * - Support checkout rollback
 * - All operations are atomic
 */

export interface ReserveInventoryItem {
  globalVariantId: mongoose.Types.ObjectId | string;
  supplierId: mongoose.Types.ObjectId | string;
  originId?: mongoose.Types.ObjectId | string; // Origin ID for multi-origin fulfillment
  quantity: number;
}

export interface ReserveInventoryParams {
  storeId: mongoose.Types.ObjectId | string;
  orderId: mongoose.Types.ObjectId | string;
  items: ReserveInventoryItem[];
  expiresInMinutes?: number; // Default: 15 minutes
  metadata?: Record<string, any>;
}

export interface ReserveInventoryResult {
  success: boolean;
  reservations?: any[];
  error?: string;
  failedItems?: Array<{ globalVariantId: string; reason: string }>;
}

/**
 * Reserve inventory for order items (transactional)
 */
export async function reserveInventory(
  params: ReserveInventoryParams
): Promise<ReserveInventoryResult> {
  const {
    storeId,
    orderId,
    items,
    expiresInMinutes = 15,
    metadata = {},
  } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;

  try {
    const result = await withTransaction(async (session: ClientSession) => {
      const reservations: any[] = [];
      const failedItems: Array<{ globalVariantId: string; reason: string }> = [];

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

      // Process each item
      for (const item of items) {
        const variantObjId = typeof item.globalVariantId === 'string'
          ? new mongoose.Types.ObjectId(item.globalVariantId)
          : item.globalVariantId;
        const supplierObjId = typeof item.supplierId === 'string'
          ? new mongoose.Types.ObjectId(item.supplierId)
          : item.supplierId;

        // If originId is provided, reserve at origin level (multi-origin fulfillment)
        if (item.originId) {
          const originObjId = typeof item.originId === 'string'
            ? new mongoose.Types.ObjectId(item.originId)
            : item.originId;

          // Get origin inventory
          const originInventory = await OriginVariantInventory.findOne({
            originId: originObjId,
            globalVariantId: variantObjId,
          }).session(session);

          if (!originInventory) {
            failedItems.push({
              globalVariantId: variantObjId.toString(),
              reason: 'Origin inventory not found',
            });
            continue;
          }

          // Check available stock at origin
          const availableStock = originInventory.availableStock;
          if (availableStock < item.quantity) {
            failedItems.push({
              globalVariantId: variantObjId.toString(),
              reason: `Insufficient stock at origin. Available: ${availableStock}, Requested: ${item.quantity}`,
            });
            continue;
          }

          // Reserve inventory at origin level atomically
          originInventory.availableStock -= item.quantity;
          originInventory.reservedStock += item.quantity;
          originInventory.lastUpdatedAt = new Date();
          await originInventory.save({ session });
        } else {
          // Fallback: Reserve at supplier level (legacy support)
          const supplierInventory = await SupplierVariantInventory.findOne({
            storeId: storeObjId,
            supplierId: supplierObjId,
            globalVariantId: variantObjId,
          }).session(session);

          if (!supplierInventory) {
            failedItems.push({
              globalVariantId: variantObjId.toString(),
              reason: 'Supplier inventory not found',
            });
            continue;
          }

          // Check available stock
          const availableStock = supplierInventory.availableStock;
          if (availableStock < item.quantity) {
            failedItems.push({
              globalVariantId: variantObjId.toString(),
              reason: `Insufficient stock. Available: ${availableStock}, Requested: ${item.quantity}`,
            });
            continue;
          }

          // Reserve inventory atomically
          supplierInventory.availableStock -= item.quantity;
          supplierInventory.reservedStock += item.quantity;
          supplierInventory.lastUpdatedAt = new Date();
          await supplierInventory.save({ session });
        }

        // Create reservation record
        const originObjId = item.originId
          ? typeof item.originId === 'string'
            ? new mongoose.Types.ObjectId(item.originId)
            : item.originId
          : null;

        const reservation = new InventoryReservation({
          storeId: storeObjId,
          orderId: orderObjId,
          globalVariantId: variantObjId,
          supplierId: supplierObjId,
          originId: originObjId,
          quantity: item.quantity,
          status: 'reserved',
          expiresAt,
          metadata: {
            ...metadata,
            variantId: variantObjId.toString(),
            supplierId: supplierObjId.toString(),
            originId: originObjId?.toString(),
          },
        });

        await reservation.save({ session });
        reservations.push(reservation);
      }

      // If any items failed, rollback transaction
      if (failedItems.length > 0) {
        throw new Error(`Failed to reserve inventory for ${failedItems.length} items`);
      }

      return { reservations, failedItems };
    });

    // Emit event
    eventStreamEmitter.emit('event', {
      eventType: 'INVENTORY_RESERVED',
      payload: {
        orderId: orderObjId.toString(),
        itemsCount: result.reservations.length,
        storeId: storeObjId.toString(),
      },
      storeId: storeObjId.toString(),
      occurredAt: new Date(),
    });

    // Audit log
    await logAudit({
      storeId: storeObjId.toString(),
      actorRole: 'system',
      action: 'INVENTORY_RESERVED',
      entityType: 'InventoryReservation',
      entityId: orderObjId.toString(),
      after: {
        orderId: orderObjId.toString(),
        itemsReserved: result.reservations.length,
        reservations: result.reservations.map((r: any) => ({
          variantId: r.globalVariantId.toString(),
          quantity: r.quantity,
        })),
      },
      description: `Inventory reserved for order ${orderId}`,
    });

    return {
      success: true,
      reservations: result.reservations,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to reserve inventory',
      failedItems: [],
    };
  }
}

/**
 * Release inventory reservations (transactional)
 */
export async function releaseInventory(
  orderId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string; reason?: string } = {}
): Promise<{ success: boolean; released: number; error?: string }> {
  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;
  const storeObjId = options.storeId
    ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
    : null;

  try {
    const result = await withTransaction(async (session: ClientSession) => {
      const filter: any = { orderId: orderObjId, status: 'reserved' };
      if (storeObjId) {
        filter.storeId = storeObjId;
      }

      const reservations = await InventoryReservation.find(filter).session(session);
      let released = 0;

      for (const reservation of reservations) {
        // Get supplier inventory
        const supplierInventory = await SupplierVariantInventory.findOne({
          storeId: reservation.storeId,
          supplierId: reservation.supplierId,
          globalVariantId: reservation.globalVariantId,
        }).session(session);

        if (supplierInventory) {
          // Release inventory atomically
          supplierInventory.availableStock += reservation.quantity;
          supplierInventory.reservedStock -= reservation.quantity;
          supplierInventory.lastUpdatedAt = new Date();
          await supplierInventory.save({ session });
        }

        // Update reservation
        reservation.status = 'released';
        reservation.releasedAt = new Date();
        await reservation.save({ session });

        released++;
      }

      return { released };
    });

    // Emit event
    if (storeObjId) {
      eventStreamEmitter.emit('event', {
        eventType: 'INVENTORY_RELEASED',
        payload: {
          orderId: orderObjId.toString(),
          releasedCount: result.released,
          reason: options.reason || 'manual',
        },
        storeId: storeObjId.toString(),
        occurredAt: new Date(),
      });
    }

    // Audit log
    await logAudit({
      storeId: storeObjId?.toString() || null,
      actorRole: 'system',
      action: 'INVENTORY_RELEASED',
      entityType: 'InventoryReservation',
      entityId: orderObjId.toString(),
      after: {
        orderId: orderObjId.toString(),
        releasedCount: result.released,
        reason: options.reason || 'manual',
      },
      description: `Inventory released for order ${orderId}`,
    });

    return {
      success: true,
      released: result.released,
    };
  } catch (error: any) {
    return {
      success: false,
      released: 0,
      error: error.message || 'Failed to release inventory',
    };
  }
}

/**
 * Consume inventory (convert reservation to consumed) - transactional
 */
export async function consumeInventory(
  orderId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<{ success: boolean; consumed: number; error?: string }> {
  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;
  const storeObjId = options.storeId
    ? (typeof options.storeId === 'string' ? new mongoose.Types.ObjectId(options.storeId) : options.storeId)
    : null;

  try {
    const result = await withTransaction(async (session: ClientSession) => {
      const filter: any = { orderId: orderObjId, status: 'reserved' };
      if (storeObjId) {
        filter.storeId = storeObjId;
      }

      const reservations = await InventoryReservation.find(filter).session(session);
      let consumed = 0;

      for (const reservation of reservations) {
        // Get supplier inventory
        const supplierInventory = await SupplierVariantInventory.findOne({
          storeId: reservation.storeId,
          supplierId: reservation.supplierId,
          globalVariantId: reservation.globalVariantId,
        }).session(session);

        if (supplierInventory) {
          // Consume inventory atomically (remove from reserved, don't add back to available)
          supplierInventory.reservedStock -= reservation.quantity;
          supplierInventory.totalStock -= reservation.quantity; // Reduce total stock
          supplierInventory.lastUpdatedAt = new Date();
          await supplierInventory.save({ session });
        }

        // Update reservation
        reservation.status = 'consumed';
        reservation.consumedAt = new Date();
        await reservation.save({ session });

        consumed++;
      }

      return { consumed };
    });

    // Emit event
    if (storeObjId) {
      eventStreamEmitter.emit('event', {
        eventType: 'INVENTORY_CONSUMED',
        payload: {
          orderId: orderObjId.toString(),
          consumedCount: result.consumed,
        },
        storeId: storeObjId.toString(),
        occurredAt: new Date(),
      });
    }

    // Audit log
    await logAudit({
      storeId: storeObjId?.toString() || null,
      actorRole: 'system',
      action: 'INVENTORY_CONSUMED',
      entityType: 'InventoryReservation',
      entityId: orderObjId.toString(),
      after: {
        orderId: orderObjId.toString(),
        consumedCount: result.consumed,
      },
      description: `Inventory consumed for order ${orderId}`,
    });

    return {
      success: true,
      consumed: result.consumed,
    };
  } catch (error: any) {
    return {
      success: false,
      consumed: 0,
      error: error.message || 'Failed to consume inventory',
    };
  }
}

/**
 * Get reservations for an order
 */
export async function getOrderReservations(
  orderId: mongoose.Types.ObjectId | string,
  options: { storeId?: mongoose.Types.ObjectId | string } = {}
): Promise<any[]> {
  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;
  const filter: any = { orderId: orderObjId };
  if (options.storeId) {
    filter.storeId = typeof options.storeId === 'string'
      ? new mongoose.Types.ObjectId(options.storeId)
      : options.storeId;
  }

  return await InventoryReservation.find(filter)
    .populate('globalVariantId', 'sku attributes')
    .populate('supplierId', 'name email')
    .lean();
}

