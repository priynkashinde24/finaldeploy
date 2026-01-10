import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import { sendSuccess, sendError } from '../utils/responseFormatter';

/**
 * GET /admin/audit-logs
 * List audit logs with filters (Admin only)
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      storeId, // Multi-tenant: filter by store
      actorRole, // Filter by actorRole
      actorId, // New: filter by actorId
      actorUserId, // Legacy: filter by actorUserId (backward compatibility)
      action,
      entityType,
      entityId,
      dateFrom,
      dateTo,
      page = '1',
      limit = '50',
    } = req.query;

    // Build filter
    const filter: any = {};

    // Multi-tenant: Filter by store (if provided or if req.store exists)
    if (storeId) {
      filter.storeId = storeId;
    } else if (req.store?.storeId) {
      // Auto-filter by current store if not specified
      filter.storeId = req.store.storeId;
    }
    // Note: If storeId is null, it means system-wide action (e.g., user registration)
    // Admins can query all stores by not providing storeId

    // Filter by actor (new field)
    if (actorRole) {
      filter.actorRole = actorRole;
    }

    if (actorId) {
      filter.actorId = actorId;
    } else if (actorUserId) {
      // Legacy: support actorUserId for backward compatibility
      filter.$or = [
        { actorId: actorUserId },
        { actorUserId: actorUserId },
      ];
    }

    if (action) {
      filter.action = action;
    }

    if (entityType) {
      filter.entityType = entityType;
    }

    if (entityId) {
      filter.entityId = entityId;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo as string);
      }
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch audit logs
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('storeId', 'name slug')
        .populate('actorId', 'name email role')
        .populate('actorUserId', 'name email role') // Legacy: for backward compatibility
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Format response
    const formattedLogs = logs.map((log: any) => ({
      id: log._id.toString(),
      store: log.storeId
        ? {
            id: log.storeId._id.toString(),
            name: log.storeId.name,
            slug: log.storeId.slug,
          }
        : null,
      actor: log.actorId
        ? {
            id: log.actorId._id.toString(),
            name: log.actorId.name,
            email: log.actorId.email,
            role: log.actorId.role,
          }
        : log.actorUserId // Legacy: fallback to actorUserId
        ? {
            id: log.actorUserId._id.toString(),
            name: log.actorUserId.name,
            email: log.actorUserId.email,
            role: log.actorUserId.role,
          }
        : null,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ? log.entityId.toString() : null,
      before: log.before || null,
      after: log.after || null,
      description: log.description,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata || {},
      createdAt: log.createdAt,
    }));

    sendSuccess(
      res,
      {
        logs: formattedLogs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Audit logs fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/audit-logs/:id
 * Get detailed audit log entry (Admin only)
 */
export const getAuditLogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const log = await AuditLog.findById(id)
      .populate('storeId', 'name slug')
      .populate('actorId', 'name email role')
      .populate('actorUserId', 'name email role') // Legacy: for backward compatibility
      .lean();

    if (!log) {
      sendError(res, 'Audit log not found', 404);
      return;
    }

    // Format response
    const formattedLog: any = {
      id: log._id.toString(),
      store: log.storeId
        ? {
            id: (log.storeId as any)._id.toString(),
            name: (log.storeId as any).name,
            slug: (log.storeId as any).slug,
          }
        : null,
      actor: log.actorId
        ? {
            id: (log.actorId as any)._id.toString(),
            name: (log.actorId as any).name,
            email: (log.actorId as any).email,
            role: (log.actorId as any).role,
          }
        : log.actorUserId // Legacy: fallback to actorUserId
        ? {
            id: (log.actorUserId as any)._id.toString(),
            name: (log.actorUserId as any).name,
            email: (log.actorUserId as any).email,
            role: (log.actorUserId as any).role,
          }
        : null,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ? log.entityId.toString() : null,
      before: log.before || null,
      after: log.after || null,
      description: log.description,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata || {},
      createdAt: log.createdAt,
    };

    sendSuccess(res, { log: formattedLog }, 'Audit log fetched successfully');
  } catch (error) {
    next(error);
  }
};

