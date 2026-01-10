import { Request } from 'express';
import mongoose from 'mongoose';
import { PCIComplianceLog, IPCIComplianceLog } from '../models/PCIComplianceLog';
import { checkRequestForPCIData } from './pciCompliance.service';

/**
 * PCI Compliance Monitoring Service
 * 
 * PURPOSE:
 * - Log PCI compliance events
 * - Monitor access to payment data
 * - Generate compliance reports
 * - Track violations
 */

export interface LogPCIEventParams {
  req?: Request;
  storeId?: string | mongoose.Types.ObjectId | null;
  userId?: string | mongoose.Types.ObjectId | null;
  userRole?: 'admin' | 'supplier' | 'reseller' | 'customer' | 'system';
  eventType: IPCIComplianceLog['eventType'];
  severity: IPCIComplianceLog['severity'];
  description: string;
  endpoint?: string;
  method?: string;
  fields?: string[];
  action: IPCIComplianceLog['action'];
  metadata?: Record<string, any>;
}

/**
 * Log a PCI compliance event
 */
export async function logPCIEvent(params: LogPCIEventParams): Promise<void> {
  try {
    const {
      req,
      storeId: providedStoreId,
      userId: providedUserId,
      userRole: providedUserRole,
      eventType,
      severity,
      description,
      endpoint,
      method,
      fields = [],
      action,
      metadata = {},
    } = params;

    // Extract storeId from req
    let storeId: mongoose.Types.ObjectId | null = null;
    if (providedStoreId) {
      storeId = typeof providedStoreId === 'string'
        ? new mongoose.Types.ObjectId(providedStoreId)
        : providedStoreId;
    } else if (req?.store?.storeId) {
      storeId = new mongoose.Types.ObjectId(req.store.storeId);
    }

    // Extract userId from req
    let userId: mongoose.Types.ObjectId | null = null;
    if (providedUserId) {
      userId = typeof providedUserId === 'string'
        ? new mongoose.Types.ObjectId(providedUserId)
        : providedUserId;
    } else if (req?.user?.id) {
      userId = new mongoose.Types.ObjectId(req.user.id);
    }

    // Extract userRole from req
    let userRole: 'admin' | 'supplier' | 'reseller' | 'customer' | 'system' | null = null;
    if (providedUserRole) {
      userRole = providedUserRole;
    } else if (req?.user?.role) {
      userRole = req.user.role as 'admin' | 'supplier' | 'reseller' | 'customer';
    }

    // Extract IP and user agent
    let ipAddress = 'unknown';
    let userAgent = 'unknown';

    if (req) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];

      if (forwardedFor) {
        ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim() || 'unknown';
      } else if (realIp) {
        ipAddress = Array.isArray(realIp) ? realIp[0] : realIp;
      } else {
        ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      }

      userAgent = req.headers['user-agent'] || 'unknown';
    }

    await PCIComplianceLog.create({
      storeId,
      eventType,
      severity,
      description,
      userId,
      userRole,
      ipAddress,
      userAgent,
      endpoint: endpoint || req?.path,
      method: method || req?.method,
      fields,
      action,
      metadata,
    });
  } catch (error) {
    // Never throw - monitoring failure should not break the application
    console.error('[PCI] Failed to log PCI event:', error);
  }
}

/**
 * Log payment data access
 */
export async function logPaymentAccess(
  req: Request,
  paymentId: string,
  action: 'view' | 'update' | 'delete',
  metadata?: Record<string, any>
): Promise<void> {
  await logPCIEvent({
    req,
    eventType: 'payment_access',
    severity: 'medium',
    description: `Payment data accessed: ${action} on payment ${paymentId}`,
    endpoint: req.path,
    method: req.method,
    action: 'allowed',
    metadata: {
      paymentId,
      action,
      ...metadata,
    },
  });
}

/**
 * Get compliance statistics
 */
export async function getComplianceStats(
  storeId?: string | mongoose.Types.ObjectId,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalEvents: number;
  violations: number;
  blocked: number;
  sanitized: number;
  bySeverity: Record<string, number>;
  byEventType: Record<string, number>;
}> {
  const filter: any = {};

  if (storeId) {
    filter.storeId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const logs = await PCIComplianceLog.find(filter).lean();

  const stats = {
    totalEvents: logs.length,
    violations: logs.filter((log) => log.eventType === 'violation').length,
    blocked: logs.filter((log) => log.action === 'blocked').length,
    sanitized: logs.filter((log) => log.action === 'sanitized').length,
    bySeverity: {} as Record<string, number>,
    byEventType: {} as Record<string, number>,
  };

  logs.forEach((log) => {
    stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
  });

  return stats;
}

/**
 * Get recent violations
 */
export async function getRecentViolations(
  limit = 50,
  storeId?: string | mongoose.Types.ObjectId
): Promise<IPCIComplianceLog[]> {
  const filter: any = {
    $or: [
      { eventType: 'violation' },
      { severity: 'critical' },
      { severity: 'high' },
    ],
  };

  if (storeId) {
    filter.storeId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  }

  return PCIComplianceLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .lean();
}

