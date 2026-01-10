import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Order } from '../models/Order';
import { sendError } from '../utils/responseFormatter';
import {
  buildCsvFile,
  buildInvoiceHeader,
  buildInvoiceRow,
  buildPaymentHeader,
  buildPaymentRow,
  xeroDate,
  getXeroTaxType,
  XeroInvoiceLine,
  XeroPayment,
} from '../utils/xeroCsv';

/**
 * Xero Export Controller
 *
 * Exports completed orders as Xero-compatible CSV files.
 *
 * Format:
 * - CSV (comma-separated values)
 * - Supports Invoice CSV with line items
 * - Optional Payment CSV for receipts
 */

const exportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['csv']).default('csv'),
  mode: z.enum(['per_order', 'daily']).default('per_order'),
  includeReceipts: z.coerce.boolean().default(false),
  includeDiscountLedger: z.coerce.boolean().default(true),
  partyLedgerMode: z.enum(['customer', 'cash']).default('customer'),
});

function parseRange(startDate: string, endDate: string): { start: Date; end: Date } {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  return { start, end };
}

function safeNumber(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function isPaidLike(order: any): boolean {
  const ps = String(order?.paymentStatus || '').toLowerCase();
  const status = String(order?.status || '').toLowerCase();
  if (ps === 'paid' || ps === 'cod_collected' || ps === 'cod_partial_paid') return true;
  if (status === 'paid') return true;
  return false;
}

function paymentAccountForPaymentMethod(order: any): string {
  const pm = String(order?.paymentMethod || '').toLowerCase();
  if (pm === 'cod' || pm === 'cod_partial') return '090'; // Cash account code (default)
  if (pm === 'paypal') return '091'; // PayPal account code (default)
  if (pm === 'stripe') return '092'; // Stripe account code (default)
  return '090'; // Default to cash/bank
}

export const exportXeroTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;

    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const parsed = exportSchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, parsed.error.errors?.[0]?.message || 'Invalid query', 400);
      return;
    }

    const { startDate, endDate, mode, includeReceipts, includeDiscountLedger, partyLedgerMode } = parsed.data;
    const { start, end } = parseRange(startDate, endDate);

    const orders = await Order.find({
      storeId,
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: { $gte: start, $lte: end },
    })
      .select(
        'orderId orderNumber createdAt customerName customerEmail paymentMethod paymentStatus status totalAmount subtotal discountAmount taxTotal taxSnapshot shippingSnapshot grandTotal totalAmountWithTax items'
      )
      .lean();

    if (mode === 'daily' && partyLedgerMode !== 'cash') {
      sendError(res, 'mode=daily requires partyLedgerMode=cash (cannot consolidate by customer party)', 400);
      return;
    }

    const invoiceRows: string[] = [];
    const paymentRows: string[] = [];
    let hasInvoices = false;
    let hasPayments = false;

    if (mode === 'per_order') {
      for (const o of orders) {
        const date = o.createdAt ? new Date(o.createdAt) : new Date();
        const invoiceNumber = o.orderNumber || o.orderId || `ORD-${Date.now()}`;
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + 30); // Default 30 days due date

        const totalAmount = safeNumber(o.totalAmount);
        const discountAmount = safeNumber(o.discountAmount);
        const subtotal = safeNumber(o.subtotal);
        const shipping = safeNumber(o.shippingSnapshot?.totalShipping);
        const taxTotal = safeNumber(o.taxSnapshot?.totalTax) || safeNumber(o.taxTotal);
        const grandTotal = safeNumber(o.grandTotal) || safeNumber(o.totalAmountWithTax) || subtotal + shipping + taxTotal;

        const customerName = partyLedgerMode === 'cash'
          ? 'Cash Sales'
          : (o.customerName || (o.customerEmail ? `Customer - ${o.customerEmail}` : 'Customer'));

        const tb = o.taxSnapshot?.taxBreakup || {};
        const taxType = getXeroTaxType(tb);

        // Main sales line item
        invoiceRows.push(
          buildInvoiceRow({
            contactName: customerName,
            emailAddress: o.customerEmail || undefined,
            invoiceNumber,
            reference: `Order ${invoiceNumber}`,
            invoiceDate: xeroDate(date),
            dueDate: xeroDate(dueDate),
            description: 'Sales',
            unitAmount: subtotal,
            accountCode: '200', // Sales account code (default)
            taxType,
            status: 'AUTHORISED',
          })
        );
        hasInvoices = true;

        // Discount line item (if enabled and discount exists)
        if (includeDiscountLedger && discountAmount > 0) {
          invoiceRows.push(
            buildInvoiceRow({
              contactName: customerName,
              emailAddress: o.customerEmail || undefined,
              invoiceNumber,
              reference: `Order ${invoiceNumber}`,
              invoiceDate: xeroDate(date),
              dueDate: xeroDate(dueDate),
              description: 'Discount',
              unitAmount: -discountAmount, // Negative for discount
              accountCode: '400', // Discount account code (default)
              taxType: 'NONE', // Discounts typically not taxed
              status: 'AUTHORISED',
            })
          );
        }

        // Shipping line item
        if (shipping > 0) {
          invoiceRows.push(
            buildInvoiceRow({
              contactName: customerName,
              emailAddress: o.customerEmail || undefined,
              invoiceNumber,
              reference: `Order ${invoiceNumber}`,
              invoiceDate: xeroDate(date),
              dueDate: xeroDate(dueDate),
              description: 'Shipping Charges',
              unitAmount: shipping,
              accountCode: '201', // Shipping Income account code (default)
              taxType,
              status: 'AUTHORISED',
            })
          );
        }

        // Tax line items (if separate tax lines are needed)
        // Note: Xero typically calculates tax automatically, but we can include as separate lines if needed
        // For now, tax is included in the main line via TaxType

        // Payment row (if enabled and order is paid)
        if (includeReceipts && isPaidLike(o)) {
          const paymentAccount = paymentAccountForPaymentMethod(o);
          paymentRows.push(
            buildPaymentRow({
              invoiceNumber,
              accountCode: paymentAccount,
              date: xeroDate(date),
              amount: grandTotal,
              reference: `Payment for Order ${invoiceNumber}`,
            })
          );
          hasPayments = true;
        }
      }
    } else {
      // Daily consolidated mode
      const dailyMap = new Map<string, any>();

      for (const o of orders) {
        const date = o.createdAt ? new Date(o.createdAt) : new Date();
        const dateKey = date.toISOString().split('T')[0];

        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, {
            date,
            totalAmount: 0,
            subtotal: 0,
            discountAmount: 0,
            shipping: 0,
            taxTotal: 0,
            taxBreakup: { cgst: 0, sgst: 0, igst: 0, vat: 0 },
            grandTotal: 0,
            orderCount: 0,
            orderNumbers: [] as string[],
          });
        }

        const daily = dailyMap.get(dateKey);
        daily.totalAmount += safeNumber(o.totalAmount);
        daily.subtotal += safeNumber(o.subtotal);
        daily.discountAmount += safeNumber(o.discountAmount);
        daily.shipping += safeNumber(o.shippingSnapshot?.totalShipping);
        daily.taxTotal += safeNumber(o.taxSnapshot?.totalTax) || safeNumber(o.taxTotal);
        daily.grandTotal += safeNumber(o.grandTotal) || safeNumber(o.totalAmountWithTax);
        daily.orderCount += 1;
        daily.orderNumbers.push(o.orderNumber || o.orderId);

        const tb = o.taxSnapshot?.taxBreakup || {};
        daily.taxBreakup.cgst += safeNumber(tb.cgst);
        daily.taxBreakup.sgst += safeNumber(tb.sgst);
        daily.taxBreakup.igst += safeNumber(tb.igst);
        daily.taxBreakup.vat += safeNumber(tb.vat);
      }

      // Create one invoice per day
      for (const [dateKey, daily] of dailyMap.entries()) {
        const invoiceNumber = `DAILY-${dateKey}`;
        const dueDate = new Date(daily.date);
        dueDate.setDate(dueDate.getDate() + 30);

        const taxType = getXeroTaxType(daily.taxBreakup);

        // Main sales line
        invoiceRows.push(
          buildInvoiceRow({
            contactName: 'Cash Sales',
            invoiceNumber,
            reference: `Daily consolidated sales - ${daily.orderCount} orders`,
            invoiceDate: xeroDate(daily.date),
            dueDate: xeroDate(dueDate),
            description: 'Sales',
            unitAmount: daily.subtotal,
            accountCode: '200', // Sales account code
            taxType,
            status: 'AUTHORISED',
          })
        );
        hasInvoices = true;

        // Discount line
        if (includeDiscountLedger && daily.discountAmount > 0) {
          invoiceRows.push(
            buildInvoiceRow({
              contactName: 'Cash Sales',
              invoiceNumber,
              reference: `Daily consolidated sales - ${daily.orderCount} orders`,
              invoiceDate: xeroDate(daily.date),
              dueDate: xeroDate(dueDate),
              description: 'Discount',
              unitAmount: -daily.discountAmount,
              accountCode: '400', // Discount account code
              taxType: 'NONE',
              status: 'AUTHORISED',
            })
          );
        }

        // Shipping line
        if (daily.shipping > 0) {
          invoiceRows.push(
            buildInvoiceRow({
              contactName: 'Cash Sales',
              invoiceNumber,
              reference: `Daily consolidated sales - ${daily.orderCount} orders`,
              invoiceDate: xeroDate(daily.date),
              dueDate: xeroDate(dueDate),
              description: 'Shipping Charges',
              unitAmount: daily.shipping,
              accountCode: '201', // Shipping Income account code
              taxType,
              status: 'AUTHORISED',
            })
          );
        }
      }
    }

    if (invoiceRows.length === 0 && paymentRows.length === 0) {
      sendError(res, 'No completed orders found in the selected date range', 404);
      return;
    }

    // Build CSV file(s)
    // Xero imports invoices and payments separately, so we'll create invoice CSV only
    // Payments can be exported separately if needed in the future
    const headers: string[] = [];
    const rows: string[] = [];

    if (hasInvoices) {
      headers.push(buildInvoiceHeader());
      rows.push(...invoiceRows);
    } else if (hasPayments && paymentRows.length > 0) {
      // If only payments, include payment header
      headers.push(buildPaymentHeader());
      rows.push(...paymentRows);
    }

    if (rows.length === 0) {
      sendError(res, 'No transactions to export', 404);
      return;
    }

    const csvContent = buildCsvFile(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="xero-export-${startDate}-to-${endDate}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    next(error);
  }
};

