import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import {
  generateProfitLossReport,
  generateTaxSummaryReport,
  generateRevenueBreakdown,
  generateConsolidatedReport,
} from '../services/financialReports.service';
import { z } from 'zod';

/**
 * Financial Reports Controller
 * 
 * PURPOSE:
 * - Generate P&L reports
 * - Tax summary reports
 * - Revenue breakdowns
 * - Role-based access
 */

const reportPeriodSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  entityType: z.enum(['supplier', 'reseller', 'platform']).optional(),
  entityId: z.string().optional(),
});

/**
 * GET /reports/profit-loss
 * Generate P&L report
 */
export const getProfitLossReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = reportPeriodSchema.parse(req.query);
    const { startDate, endDate, entityType, entityId } = validatedData;

    // Determine entity type and ID from user role if not provided
    let reportEntityType: 'supplier' | 'reseller' | 'platform';
    let reportEntityId: string;

    // Admin can view any entity, others can only view their own
    if (currentUser.role === 'admin') {
      // Admin must provide entityType and entityId
      if (!entityType || !entityId) {
        sendError(res, 'Entity type and ID are required for admin reports', 400);
        return;
      }
      reportEntityType = entityType;
      reportEntityId = entityId;
    } else {
      // Non-admin users can only view their own reports
      if (entityType && entityType !== currentUser.role) {
        sendError(res, 'You can only view reports for your own entity', 403);
        return;
      }
      reportEntityType = (currentUser.role as 'supplier' | 'reseller' | 'platform');
      reportEntityId = currentUser.id;
    }

    const report = await generateProfitLossReport(
      reportEntityType,
      reportEntityId,
      storeId,
      new Date(startDate),
      new Date(endDate)
    );

    sendSuccess(res, report, 'Profit & Loss report generated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reports/tax-summary
 * Generate tax summary report
 */
export const getTaxSummaryReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = reportPeriodSchema.parse(req.query);
    const { startDate, endDate, entityType, entityId } = validatedData;

    const taxType = (req.query.taxType as 'gst' | 'vat' | 'all') || 'all';

    // Admin can view all, others can only view their own
    let reportEntityType: 'supplier' | 'reseller' | 'platform' | 'all';
    let reportEntityId: string | undefined;

    if (currentUser.role === 'admin') {
      reportEntityType = entityType || 'all';
      reportEntityId = entityId;
    } else {
      // Non-admin users can only view their own reports
      if (entityType && entityType !== currentUser.role) {
        sendError(res, 'You can only view reports for your own entity', 403);
        return;
      }
      reportEntityType = (currentUser.role as 'supplier' | 'reseller' | 'platform');
      reportEntityId = entityId || currentUser.id;
    }

    const report = await generateTaxSummaryReport(
      reportEntityType,
      reportEntityId,
      storeId,
      new Date(startDate),
      new Date(endDate),
      taxType
    );

    sendSuccess(res, report, 'Tax summary report generated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reports/revenue-breakdown
 * Generate revenue breakdown report
 */
export const getRevenueBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = reportPeriodSchema.parse(req.query);
    const { startDate, endDate, entityType, entityId } = validatedData;

    // Determine entity type and ID from user role if not provided
    let reportEntityType: 'supplier' | 'reseller' | 'platform';
    let reportEntityId: string;

    // Admin can view any entity, others can only view their own
    if (currentUser.role === 'admin') {
      // Admin must provide entityType and entityId
      if (!entityType || !entityId) {
        sendError(res, 'Entity type and ID are required for admin reports', 400);
        return;
      }
      reportEntityType = entityType;
      reportEntityId = entityId;
    } else {
      // Non-admin users can only view their own reports
      if (entityType && entityType !== currentUser.role) {
        sendError(res, 'You can only view reports for your own entity', 403);
        return;
      }
      reportEntityType = (currentUser.role as 'supplier' | 'reseller' | 'platform');
      reportEntityId = currentUser.id;
    }

    const report = await generateRevenueBreakdown(
      reportEntityType,
      reportEntityId,
      storeId,
      new Date(startDate),
      new Date(endDate)
    );

    sendSuccess(res, report, 'Revenue breakdown report generated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /reports/consolidated
 * Generate consolidated financial report (admin only)
 */
export const getConsolidatedReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view consolidated reports', 403);
      return;
    }

    const validatedData = z
      .object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
      .parse(req.query);

    const { startDate, endDate } = validatedData;

    const report = await generateConsolidatedReport(storeId, new Date(startDate), new Date(endDate));

    sendSuccess(res, report, 'Consolidated financial report generated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

