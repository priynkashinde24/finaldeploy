import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Order } from '../models/Order';
import { sendError } from '../utils/responseFormatter';
import {
  buildIifFile,
  buildInvoiceRow,
  buildSplitRow,
  buildDepositRow,
  buildEndTransaction,
  buildInvoiceHeader,
  buildSplitHeader,
  buildDepositHeader,
} from '../utils/quickbooksIif';

/**
 * QuickBooks Export Controller
 *
 * Exports completed orders as QuickBooks-compatible IIF (Intuit Interchange Format) files.
 *
 * Format:
 * - IIF (tab-delimited text file)
 * - Supports Invoice transactions with line item splits
 * - Optional deposit/receipt transactions
 */

const exportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['iif']).default('iif'),
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

function receiptAccountForPaymentMethod(order: any): string {
  const pm = String(order?.paymentMethod || '').toLowerCase();
  if (pm === 'cod' || pm === 'cod_partial') return 'Cash';
  if (pm === 'paypal') return 'PayPal Account';
  if (pm === 'stripe') return 'Stripe Account';
  return 'Bank Account';
}

export const exportQuickBooksTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    const transactions: string[] = [];
    let hasInvoices = false;
    let hasDeposits = false;

    if (mode === 'per_order') {
      for (const o of orders) {
        const date = o.createdAt ? new Date(o.createdAt) : new Date();
        const docNum = o.orderNumber || o.orderId || `ORD-${Date.now()}`;

        const totalAmount = safeNumber(o.totalAmount);
        const discountAmount = safeNumber(o.discountAmount);
        const subtotal = safeNumber(o.subtotal);
        const shipping = safeNumber(o.shippingSnapshot?.totalShipping);
        const taxTotal = safeNumber(o.taxSnapshot?.totalTax) || safeNumber(o.taxTotal);
        const grandTotal = safeNumber(o.grandTotal) || safeNumber(o.totalAmountWithTax) || subtotal + shipping + taxTotal;

        const customerName = partyLedgerMode === 'cash'
          ? 'Cash Sales'
          : (o.customerName || (o.customerEmail ? `Customer - ${o.customerEmail}` : 'Customer'));

        const memo = `Order ${docNum}${o.customerEmail ? ` - ${o.customerEmail}` : ''}`;

        // Invoice header (debit to customer/accounts receivable)
        transactions.push(
          buildInvoiceRow({
            date,
            account: partyLedgerMode === 'cash' ? 'Cash' : 'Accounts Receivable',
            name: customerName,
            amount: grandTotal,
            docNum,
            memo,
          })
        );
        hasInvoices = true;

        // Sales line item (credit to Sales account)
        transactions.push(
          buildSplitRow({
            date,
            account: 'Sales',
            name: customerName,
            amount: subtotal,
            docNum,
            memo: 'Sales',
          })
        );

        // Discount line item (if enabled and discount exists)
        if (includeDiscountLedger && discountAmount > 0) {
          transactions.push(
            buildSplitRow({
              date,
              account: 'Discount',
              name: customerName,
              amount: discountAmount,
              docNum,
              memo: 'Discount',
            })
          );
        }

        // Shipping line item
        if (shipping > 0) {
          transactions.push(
            buildSplitRow({
              date,
              account: 'Shipping Income',
              name: customerName,
              amount: shipping,
              docNum,
              memo: 'Shipping Charges',
            })
          );
        }

        // Tax line items
        const tb = o.taxSnapshot?.taxBreakup || {};
        const cgst = safeNumber(tb.cgst);
        const sgst = safeNumber(tb.sgst);
        const igst = safeNumber(tb.igst);
        const vat = safeNumber(tb.vat);

        if (cgst > 0) {
          transactions.push(
            buildSplitRow({
              date,
              account: 'Sales Tax Payable - CGST',
              name: customerName,
              amount: cgst,
              docNum,
              memo: 'CGST',
            })
          );
        }
        if (sgst > 0) {
          transactions.push(
            buildSplitRow({
              date,
              account: 'Sales Tax Payable - SGST',
              name: customerName,
              amount: sgst,
              docNum,
              memo: 'SGST',
            })
          );
        }
        if (igst > 0) {
          transactions.push(
            buildSplitRow({
              date,
              account: 'Sales Tax Payable - IGST',
              name: customerName,
              amount: igst,
              docNum,
              memo: 'IGST',
            })
          );
        }
        if (vat > 0) {
          transactions.push(
            buildSplitRow({
              date,
              account: 'Sales Tax Payable - VAT',
              name: customerName,
              amount: vat,
              docNum,
              memo: 'VAT',
            })
          );
        }

        // End transaction marker
        transactions.push(buildEndTransaction());

        // Receipt/Deposit transaction (if enabled and order is paid)
        if (includeReceipts && isPaidLike(o)) {
          const receiptAccount = receiptAccountForPaymentMethod(o);
          transactions.push(
            buildDepositRow({
              date,
              depositAccount: receiptAccount,
              amount: grandTotal,
              memo: `Payment for Order ${docNum}`,
            })
          );
          hasDeposits = true;
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
        const docNum = `DAILY-${dateKey}`;
        const memo = `Daily consolidated sales - ${daily.orderCount} orders`;

        transactions.push(
          buildInvoiceRow({
            date: daily.date,
            account: 'Cash',
            name: 'Cash Sales',
            amount: daily.grandTotal,
            docNum,
            memo,
          })
        );
        hasInvoices = true;

        // Sales line
        transactions.push(
          buildSplitRow({
            date: daily.date,
            account: 'Sales',
            name: 'Cash Sales',
            amount: daily.subtotal,
            docNum,
            memo: 'Sales',
          })
        );

        // Discount line
        if (includeDiscountLedger && daily.discountAmount > 0) {
          transactions.push(
            buildSplitRow({
              date: daily.date,
              account: 'Discount',
              name: 'Cash Sales',
              amount: daily.discountAmount,
              docNum,
              memo: 'Discount',
            })
          );
        }

        // Shipping line
        if (daily.shipping > 0) {
          transactions.push(
            buildSplitRow({
              date: daily.date,
              account: 'Shipping Income',
              name: 'Cash Sales',
              amount: daily.shipping,
              docNum,
              memo: 'Shipping Charges',
            })
          );
        }

        // Tax lines
        if (daily.taxBreakup.cgst > 0) {
          transactions.push(
            buildSplitRow({
              date: daily.date,
              account: 'Sales Tax Payable - CGST',
              name: 'Cash Sales',
              amount: daily.taxBreakup.cgst,
              docNum,
              memo: 'CGST',
            })
          );
        }
        if (daily.taxBreakup.sgst > 0) {
          transactions.push(
            buildSplitRow({
              date: daily.date,
              account: 'Sales Tax Payable - SGST',
              name: 'Cash Sales',
              amount: daily.taxBreakup.sgst,
              docNum,
              memo: 'SGST',
            })
          );
        }
        if (daily.taxBreakup.igst > 0) {
          transactions.push(
            buildSplitRow({
              date: daily.date,
              account: 'Sales Tax Payable - IGST',
              name: 'Cash Sales',
              amount: daily.taxBreakup.igst,
              docNum,
              memo: 'IGST',
            })
          );
        }
        if (daily.taxBreakup.vat > 0) {
          transactions.push(
            buildSplitRow({
              date: daily.date,
              account: 'Sales Tax Payable - VAT',
              name: 'Cash Sales',
              amount: daily.taxBreakup.vat,
              docNum,
              memo: 'VAT',
            })
          );
        }

        transactions.push(buildEndTransaction());
      }
    }

    if (transactions.length === 0) {
      sendError(res, 'No completed orders found in the selected date range', 404);
      return;
    }

    // Build IIF file with appropriate headers
    const iifContent = buildIifFile(transactions);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quickbooks-export-${startDate}-to-${endDate}.iif"`);
    res.send(iifContent);
  } catch (error: any) {
    next(error);
  }
};

