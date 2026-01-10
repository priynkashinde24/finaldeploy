import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { getComplianceStats as getComplianceStatsService, getRecentViolations } from '../services/pciMonitoring.service';
import { PCIComplianceLog } from '../models/PCIComplianceLog';
import { logAudit } from '../utils/auditLogger';

/**
 * PCI Compliance Controller
 * 
 * PURPOSE:
 * - Provide endpoints for PCI compliance monitoring
 * - Generate compliance reports
 * - View compliance logs
 */

/**
 * GET /api/admin/pci-compliance/stats
 * Get PCI compliance statistics
 */
export const getComplianceStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const stats = await getComplianceStatsService(storeId || undefined, start, end);

    // Audit log
    await logAudit({
      req,
      action: 'PCI_COMPLIANCE_STATS_VIEWED',
      entityType: 'PCICompliance',
      description: 'PCI compliance statistics viewed',
      metadata: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString(),
      },
    });

    sendSuccess(res, { stats }, 'Compliance statistics retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/admin/pci-compliance/violations
 * Get recent PCI compliance violations
 */
export const getViolations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;

    const violations = await getRecentViolations(limit, storeId || undefined);

    // Audit log
    await logAudit({
      req,
      action: 'PCI_COMPLIANCE_VIOLATIONS_VIEWED',
      entityType: 'PCICompliance',
      description: 'PCI compliance violations viewed',
      metadata: {
        limit,
      },
    });

    sendSuccess(res, { violations }, 'Violations retrieved');
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/admin/pci-compliance/logs
 * Get PCI compliance logs with filters
 */
export const getComplianceLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const {
      eventType,
      severity,
      startDate,
      endDate,
      limit = 100,
      page = 1,
    } = req.query;

    const filter: any = {};

    if (storeId) {
      filter.storeId = storeId;
    }

    if (eventType) {
      filter.eventType = eventType;
    }

    if (severity) {
      filter.severity = severity;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const logs = await PCIComplianceLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .populate('userId', 'name email')
      .lean();

    const total = await PCIComplianceLog.countDocuments(filter);

    // Audit log
    await logAudit({
      req,
      action: 'PCI_COMPLIANCE_LOGS_VIEWED',
      entityType: 'PCICompliance',
      description: 'PCI compliance logs viewed',
      metadata: {
        filters: filter,
        limit,
        page,
      },
    });

    sendSuccess(
      res,
      {
        logs,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
      'Compliance logs retrieved'
    );
  } catch (error: any) {
    next(error);
  }
};

