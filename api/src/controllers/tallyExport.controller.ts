import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Order } from '../models/Order';
import { sendError } from '../utils/responseFormatter';
import { buildTallyEnvelope, money, tallyDate, xmlText } from '../utils/tallyXml';

/**
 * Tally Export Controller
 *
 * Exports completed orders as Tally-compatible XML vouchers.
 *
 * Initial scope:
 * - Sales vouchers for completed orders (confirmed/delivered)
 * - Uses Order totals + taxSnapshot to split GST ledgers when available
 */

const exportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  voucherType: z.enum(['sales']).default('sales'),
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

function buildLedgerEntry(params: {
  ledgerName: string;
  amount: number;
  isDeemedPositive?: boolean;
}): string {
  const { ledgerName, amount, isDeemedPositive } = params;
  // In Tally XML, AMOUNT is signed. Convention:
  // - Party (debit) entry is positive amount with ISDEEMEDPOSITIVE="No"
  // - Sales/tax credits are negative with ISDEEMEDPOSITIVE="Yes"
  const deemed = isDeemedPositive ? 'Yes' : 'No';
  return `<LEDGERENTRIES.LIST>
    <LEDGERNAME>${xmlText(ledgerName)}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>${deemed}</ISDEEMEDPOSITIVE>
    <AMOUNT>${money(amount)}</AMOUNT>
  </LEDGERENTRIES.LIST>`;
}

function safeNumber(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function isPaidLike(order: any): boolean {
  const ps = String(order?.paymentStatus || '').toLowerCase();
  const status = String(order?.status || '').toLowerCase();
  // In this codebase paymentStatus can be: paid, cod_collected, cod_partial_paid, etc.
  if (ps === 'paid' || ps === 'cod_collected' || ps === 'cod_partial_paid') return true;
  if (status === 'paid') return true;
  return false;
}

function receiptLedgerForPaymentMethod(order: any): string {
  const pm = String(order?.paymentMethod || '').toLowerCase();
  if (pm === 'cod' || pm === 'cod_partial') return 'Cash';
  if (pm === 'paypal') return 'PayPal';
  // default to Stripe / online
  return 'Stripe';
}

function buildSalesVoucherXml(params: {
  date: Date;
  voucherNo: string;
  partyLedger: string;
  narration: string;
  totals: {
    totalAmount: number;
    discountAmount: number;
    shipping: number;
    taxTotal: number;
    taxBreakup: { cgst: number; sgst: number; igst: number; vat: number };
    grandTotal: number;
  };
  includeDiscountLedger: boolean;
}): string {
  const { date, voucherNo, partyLedger, narration, totals, includeDiscountLedger } = params;

  const SALES_LEDGER = 'Sales';
  const DISCOUNT_LEDGER = 'Discount';
  const SHIPPING_LEDGER = 'Shipping Charges';
  const OUTPUT_CGST = 'Output CGST';
  const OUTPUT_SGST = 'Output SGST';
  const OUTPUT_IGST = 'Output IGST';
  const OUTPUT_VAT = 'Output VAT';
  const ROUND_OFF = 'Round Off';

  const entries: string[] = [];

  // Party debit
  entries.push(buildLedgerEntry({ ledgerName: partyLedger, amount: totals.grandTotal, isDeemedPositive: false }));

  // Sales credit (gross sales)
  entries.push(
    buildLedgerEntry({
      ledgerName: SALES_LEDGER,
      amount: -Math.max(0, totals.totalAmount),
      isDeemedPositive: true,
    })
  );

  // Discount debit
  if (includeDiscountLedger && totals.discountAmount > 0) {
    entries.push(
      buildLedgerEntry({
        ledgerName: DISCOUNT_LEDGER,
        amount: totals.discountAmount,
        isDeemedPositive: false,
      })
    );
  }

  // Shipping credit
  if (totals.shipping > 0) {
    entries.push(buildLedgerEntry({ ledgerName: SHIPPING_LEDGER, amount: -totals.shipping, isDeemedPositive: true }));
  }

  const { cgst, sgst, igst, vat } = totals.taxBreakup;
  if (cgst > 0) entries.push(buildLedgerEntry({ ledgerName: OUTPUT_CGST, amount: -cgst, isDeemedPositive: true }));
  if (sgst > 0) entries.push(buildLedgerEntry({ ledgerName: OUTPUT_SGST, amount: -sgst, isDeemedPositive: true }));
  if (igst > 0) entries.push(buildLedgerEntry({ ledgerName: OUTPUT_IGST, amount: -igst, isDeemedPositive: true }));
  if (vat > 0) entries.push(buildLedgerEntry({ ledgerName: OUTPUT_VAT, amount: -vat, isDeemedPositive: true }));

  if (totals.taxTotal > 0 && cgst + sgst + igst + vat === 0) {
    entries.push(buildLedgerEntry({ ledgerName: OUTPUT_IGST, amount: -totals.taxTotal, isDeemedPositive: true }));
  }

  // Round off (balance)
  const debitSum = entries
    .filter((e) => e.includes('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>'))
    .reduce((sum, xml) => {
      const m = xml.match(/<AMOUNT>(-?\d+(\.\d+)?)<\/AMOUNT>/);
      return sum + (m ? Number(m[1]) : 0);
    }, 0);
  const creditSum = entries
    .filter((e) => e.includes('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>'))
    .reduce((sum, xml) => {
      const m = xml.match(/<AMOUNT>(-?\d+(\.\d+)?)<\/AMOUNT>/);
      return sum + (m ? Number(m[1]) : 0);
    }, 0);
  const imbalance = Number((debitSum + creditSum).toFixed(2));
  if (Math.abs(imbalance) >= 0.01) {
    const amt = -imbalance;
    const isCredit = amt < 0;
    entries.push(buildLedgerEntry({ ledgerName: ROUND_OFF, amount: amt, isDeemedPositive: isCredit }));
  }

  return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>${tallyDate(date)}</DATE>
    <VOUCHERNUMBER>${xmlText(voucherNo)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${xmlText(partyLedger)}</PARTYLEDGERNAME>
    <NARRATION>${xmlText(narration)}</NARRATION>
    ${entries.join('\n')}
  </VOUCHER>
</TALLYMESSAGE>`;
}

function buildReceiptVoucherXml(params: {
  date: Date;
  voucherNo: string;
  partyLedger: string;
  receiptLedger: string;
  amount: number;
  narration: string;
}): string {
  const { date, voucherNo, partyLedger, receiptLedger, amount, narration } = params;
  const entries: string[] = [];

  // Receipt voucher: debit bank/cash, credit party
  entries.push(buildLedgerEntry({ ledgerName: receiptLedger, amount: amount, isDeemedPositive: false }));
  entries.push(buildLedgerEntry({ ledgerName: partyLedger, amount: -amount, isDeemedPositive: true }));

  return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Receipt" ACTION="Create">
    <DATE>${tallyDate(date)}</DATE>
    <VOUCHERNUMBER>${xmlText(voucherNo)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${xmlText(partyLedger)}</PARTYLEDGERNAME>
    <NARRATION>${xmlText(narration)}</NARRATION>
    ${entries.join('\n')}
  </VOUCHER>
</TALLYMESSAGE>`;
}

export const exportTallyVouchers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    const { startDate, endDate, voucherType, mode, includeReceipts, includeDiscountLedger, partyLedgerMode } =
      parsed.data;
    const { start, end } = parseRange(startDate, endDate);

    const orders = await Order.find({
      storeId,
      orderStatus: { $in: ['confirmed', 'delivered'] },
      createdAt: { $gte: start, $lte: end },
    })
      .select(
        'orderId orderNumber createdAt customerName customerEmail paymentMethod paymentStatus status totalAmount subtotal discountAmount taxTotal taxSnapshot shippingSnapshot grandTotal totalAmountWithTax'
      )
      .lean();

    if (mode === 'daily' && partyLedgerMode !== 'cash') {
      sendError(res, 'mode=daily requires partyLedgerMode=cash (cannot consolidate by customer party)', 400);
      return;
    }

    const vouchers: string[] = [];

    if (mode === 'per_order') {
      for (const o of orders) {
        const date = o.createdAt ? new Date(o.createdAt) : new Date();
        const voucherNo = o.orderNumber || o.orderId || `ORD-${Date.now()}`;

        const totalAmount = safeNumber(o.totalAmount);
        const discountAmount = safeNumber(o.discountAmount);
        const subtotal = safeNumber(o.subtotal);
        const shipping = safeNumber(o.shippingSnapshot?.totalShipping);
        const taxTotal = safeNumber(o.taxSnapshot?.totalTax) || safeNumber(o.taxTotal);
        const grandTotal = safeNumber(o.grandTotal) || safeNumber(o.totalAmountWithTax) || subtotal + shipping + taxTotal;

        const partyLedger =
          partyLedgerMode === 'cash'
            ? 'Cash'
            : xmlText(o.customerName) || (o.customerEmail ? `Customer - ${o.customerEmail}` : 'Customer');

        const narrationParts: string[] = [];
        if (o.paymentMethod) narrationParts.push(`PM: ${o.paymentMethod}`);
        if (o.customerEmail) narrationParts.push(`Email: ${o.customerEmail}`);
        const narration = narrationParts.join(' | ');

        const tb = o.taxSnapshot?.taxBreakup || {};
        const totals = {
          totalAmount,
          discountAmount,
          shipping,
          taxTotal,
          taxBreakup: {
            cgst: safeNumber(tb.cgst),
            sgst: safeNumber(tb.sgst),
            igst: safeNumber(tb.igst),
            vat: safeNumber(tb.vat),
          },
          grandTotal,
        };

        vouchers.push(
          buildSalesVoucherXml({
            date,
            voucherNo,
            partyLedger,
            narration,
            totals,
            includeDiscountLedger,
          })
        );

        if (includeReceipts && isPaidLike(o)) {
          const receiptLedger = receiptLedgerForPaymentMethod(o);
          vouchers.push(
            buildReceiptVoucherXml({
              date,
              voucherNo: `RCPT-${voucherNo}`,
              partyLedger,
              receiptLedger,
              amount: grandTotal,
              narration: `Receipt for ${voucherNo}`,
            })
          );
        }
      }
    } else {
      // daily consolidated (cash party)
      const byDay = new Map<string, any>();
      for (const o of orders) {
        const date = o.createdAt ? new Date(o.createdAt) : new Date();
        const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
          date.getUTCDate()
        ).padStart(2, '0')}`;

        if (!byDay.has(dayKey)) {
          byDay.set(dayKey, {
            date,
            totalAmount: 0,
            discountAmount: 0,
            shipping: 0,
            taxTotal: 0,
            taxBreakup: { cgst: 0, sgst: 0, igst: 0, vat: 0 },
            grandTotal: 0,
            receipts: { Cash: 0, Stripe: 0, PayPal: 0 },
          });
        }

        const totalAmount = safeNumber(o.totalAmount);
        const discountAmount = safeNumber(o.discountAmount);
        const subtotal = safeNumber(o.subtotal);
        const shipping = safeNumber(o.shippingSnapshot?.totalShipping);
        const taxTotal = safeNumber(o.taxSnapshot?.totalTax) || safeNumber(o.taxTotal);
        const grandTotal = safeNumber(o.grandTotal) || safeNumber(o.totalAmountWithTax) || subtotal + shipping + taxTotal;
        const tb = o.taxSnapshot?.taxBreakup || {};

        const agg = byDay.get(dayKey);
        agg.totalAmount += totalAmount;
        agg.discountAmount += discountAmount;
        agg.shipping += shipping;
        agg.taxTotal += taxTotal;
        agg.taxBreakup.cgst += safeNumber(tb.cgst);
        agg.taxBreakup.sgst += safeNumber(tb.sgst);
        agg.taxBreakup.igst += safeNumber(tb.igst);
        agg.taxBreakup.vat += safeNumber(tb.vat);
        agg.grandTotal += grandTotal;

        if (includeReceipts && isPaidLike(o)) {
          const ledger = receiptLedgerForPaymentMethod(o);
          agg.receipts[ledger] = (agg.receipts[ledger] || 0) + grandTotal;
        }
      }

      for (const [dayKey, agg] of byDay.entries()) {
        vouchers.push(
          buildSalesVoucherXml({
            date: agg.date,
            voucherNo: `SALES-${dayKey}`,
            partyLedger: 'Cash',
            narration: `Daily consolidated sales ${dayKey}`,
            totals: {
              totalAmount: agg.totalAmount,
              discountAmount: agg.discountAmount,
              shipping: agg.shipping,
              taxTotal: agg.taxTotal,
              taxBreakup: agg.taxBreakup,
              grandTotal: agg.grandTotal,
            },
            includeDiscountLedger,
          })
        );

        if (includeReceipts) {
          for (const [ledger, amt] of Object.entries(agg.receipts)) {
            const amount = safeNumber(amt);
            if (amount <= 0) continue;
            vouchers.push(
              buildReceiptVoucherXml({
                date: agg.date,
                voucherNo: `RCPT-${dayKey}-${ledger.toUpperCase()}`,
                partyLedger: 'Cash',
                receiptLedger: ledger,
                amount,
                narration: `Daily receipts ${dayKey} (${ledger})`,
              })
            );
          }
        }
      }
    }

    const vouchersXml = vouchers.join('\n');

    const xml = buildTallyEnvelope(vouchersXml);

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tally-sales-${startDate}-to-${endDate}.xml"`
    );
    res.status(200).send(xml);
  } catch (error: any) {
    next(error);
  }
};


