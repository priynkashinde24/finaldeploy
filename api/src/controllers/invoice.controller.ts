import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { Invoice } from '../models/Invoice';
import { CreditNote } from '../models/CreditNote';
import { generateInvoices } from '../services/invoiceGenerator.service';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Invoice Controller
 * 
 * PURPOSE:
 * - View invoices with role-based access control
 * - Download invoice PDFs
 * - Generate invoices on demand
 * - Issue credit notes
 * 
 * ACCESS CONTROL:
 * - Admin: All invoices
 * - Supplier: Own supplier invoices only
 * - Reseller: Own reseller invoices only
 * - Customer: Own customer invoices only
 */

const getInvoicesSchema = z.object({
  orderId: z.string().optional(),
  invoiceType: z.enum(['customer', 'supplier', 'reseller', 'platform']).optional(),
  status: z.enum(['issued', 'cancelled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /invoices
 * Get invoices with role-based filtering
 */
export const getInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const validatedData = getInvoicesSchema.parse(req.query);

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

    // Role-based filtering
    if (currentUser.role === 'supplier') {
      query.invoiceType = 'supplier';
      query.entityId = currentUser.id;
    } else if (currentUser.role === 'reseller') {
      query.invoiceType = 'reseller';
      query.entityId = currentUser.id;
    } else if (currentUser.role === 'admin') {
      // Admin can see all invoices
      if (validatedData.invoiceType) {
        query.invoiceType = validatedData.invoiceType;
      }
    } else {
      // Customer or other roles - only customer invoices
      query.invoiceType = 'customer';
      // Note: For customers, we'd need to match by email or order ownership
      // This is simplified - in production, link customer invoices to user accounts
    }

    if (validatedData.orderId) {
      query.orderId = validatedData.orderId;
    }

    if (validatedData.status) {
      query.status = validatedData.status;
    }

    const invoices = await Invoice.find(query)
      .sort({ issuedAt: -1 })
      .limit(validatedData.limit)
      .skip(validatedData.offset)
      .populate('paymentSplitId')
      .lean();

    const total = await Invoice.countDocuments(query);

    sendSuccess(
      res,
      {
        invoices,
        pagination: {
          total,
          limit: validatedData.limit,
          offset: validatedData.offset,
          hasMore: validatedData.offset + validatedData.limit < total,
        },
      },
      'Invoices retrieved successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /invoices/:orderId
 * Get all invoices for an order
 */
export const getInvoicesByOrderId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { orderId } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const query: any = {
      storeId: new mongoose.Types.ObjectId(storeId),
      orderId,
    };

    // Role-based filtering
    if (currentUser.role === 'supplier') {
      query.invoiceType = 'supplier';
      query.entityId = currentUser.id;
    } else if (currentUser.role === 'reseller') {
      query.invoiceType = 'reseller';
      query.entityId = currentUser.id;
    }
    // Admin can see all, customer can see customer invoice

    const invoices = await Invoice.find(query)
      .sort({ invoiceType: 1 })
      .populate('paymentSplitId')
      .lean();

    // Get credit notes
    const creditNotes = await CreditNote.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      orderId,
    })
      .populate('invoiceId')
      .lean();

    sendSuccess(
      res,
      {
        invoices,
        creditNotes,
      },
      'Invoices retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /invoices/download/:invoiceId
 * Download invoice PDF
 */
export const downloadInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { invoiceId } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      storeId: new mongoose.Types.ObjectId(storeId),
    });

    if (!invoice) {
      sendError(res, 'Invoice not found', 404);
      return;
    }

    // Role-based access control
    if (currentUser.role === 'supplier' && (invoice.invoiceType !== 'supplier' || invoice.entityId !== currentUser.id)) {
      sendError(res, 'Access denied', 403);
      return;
    }

    if (currentUser.role === 'reseller' && (invoice.invoiceType !== 'reseller' || invoice.entityId !== currentUser.id)) {
      sendError(res, 'Access denied', 403);
      return;
    }

    // Check if PDF exists
    if (!invoice.pdfPath || !fs.existsSync(invoice.pdfPath)) {
      // Generate PDF if it doesn't exist
      const { generateInvoicePdf } = await import('../services/invoicePdf.service');
      const pdfPath = await generateInvoicePdf(invoice);
      invoice.pdfPath = pdfPath;
      await invoice.save();
    }

    // Audit log
    await logAudit({
      req,
      action: 'INVOICE_DOWNLOADED',
      entityType: 'Invoice',
      entityId: invoice._id.toString(),
      description: `Invoice ${invoice.invoiceNumber} downloaded`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        orderId: invoice.orderId,
        invoiceType: invoice.invoiceType,
      },
    });

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    fs.createReadStream(invoice.pdfPath).pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /invoices/generate/:orderId
 * Generate invoices for an order (admin only)
 */
export const generateInvoicesForOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;
    const { orderId } = req.params;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store context required', 401);
      return;
    }

    if (currentUser.role !== 'admin') {
      sendError(res, 'Only admins can generate invoices', 403);
      return;
    }

    const result = await generateInvoices(orderId);

    if (!result.success) {
      sendError(res, result.error || 'Failed to generate invoices', 400);
      return;
    }

    sendSuccess(
      res,
      {
        invoices: result.invoices,
        count: result.invoices?.length || 0,
      },
      'Invoices generated successfully'
    );
  } catch (error) {
    next(error);
  }
};
