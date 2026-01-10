import mongoose from 'mongoose';
import { PaymentSplit } from '../models/PaymentSplit';
import { PayoutLedger } from '../models/PayoutLedger';
import { Invoice } from '../models/Invoice';
import { CreditNote } from '../models/CreditNote';
import { Order } from '../models/Order';

/**
 * Financial Reports Service
 * 
 * PURPOSE:
 * - Generate P&L reports per entity
 * - GST/VAT summary reports
 * - Revenue breakdowns
 * - Tax compliance reports
 * 
 * ENTITIES:
 * - Supplier: Revenue from sales, payouts received
 * - Reseller: Margin earned, payouts received
 * - Platform: Commission earned
 */

export interface ProfitLossReport {
  entityType: 'supplier' | 'reseller' | 'platform';
  entityId: string;
  period: {
    start: Date;
    end: Date;
  };
  revenue: {
    total: number;
    fromOrders: number;
    fromOther: number;
  };
  expenses: {
    total: number;
    payouts: number;
    refunds: number;
    other: number;
  };
  netProfit: number;
  orderCount: number;
  averageOrderValue: number;
  currency: string;
}

export interface TaxSummaryReport {
  entityType: 'supplier' | 'reseller' | 'platform' | 'all';
  entityId?: string;
  period: {
    start: Date;
    end: Date;
  };
  taxType: 'gst' | 'vat' | 'all';
  summary: {
    totalSales: number;
    totalTaxCollected: number;
    totalTaxPaid: number;
    netTaxLiability: number;
    orderCount: number;
  };
  breakdown: {
    cgst?: number;
    sgst?: number;
    igst?: number;
    vat?: number;
  };
  byMonth: Array<{
    month: string;
    sales: number;
    taxCollected: number;
    orderCount: number;
  }>;
}

export interface RevenueBreakdown {
  entityType: 'supplier' | 'reseller' | 'platform';
  entityId: string;
  period: {
    start: Date;
    end: Date;
  };
  byPaymentMethod: {
    stripe: { revenue: number; orderCount: number };
    paypal: { revenue: number; orderCount: number };
    cod: { revenue: number; orderCount: number };
  };
  byStatus: {
    pending: number;
    eligible: number;
    paid: number;
  };
  trends: Array<{
    date: string;
    revenue: number;
    orderCount: number;
  }>;
}

/**
 * Generate P&L report for an entity
 */
export async function generateProfitLossReport(
  entityType: 'supplier' | 'reseller' | 'platform',
  entityId: string,
  storeId: string,
  startDate: Date,
  endDate: Date
): Promise<ProfitLossReport> {
  const storeObjId = new mongoose.Types.ObjectId(storeId);

  // Get all payment splits for this entity in the period
  const splits = await PaymentSplit.find({
    storeId: storeObjId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  // Filter splits by entity
  let relevantSplits: any[] = [];
  if (entityType === 'supplier') {
    relevantSplits = splits.filter((s) => s.supplierId.toString() === entityId);
  } else if (entityType === 'reseller') {
    relevantSplits = splits.filter((s) => s.resellerId === entityId);
  } else if (entityType === 'platform') {
    relevantSplits = splits; // Platform gets commission from all
  }

  // Calculate revenue
  let totalRevenue = 0;
  if (entityType === 'supplier') {
    totalRevenue = relevantSplits.reduce((sum, s) => sum + s.supplierAmount, 0);
  } else if (entityType === 'reseller') {
    totalRevenue = relevantSplits.reduce((sum, s) => sum + s.resellerAmount, 0);
  } else if (entityType === 'platform') {
    totalRevenue = relevantSplits.reduce((sum, s) => sum + s.platformAmount, 0);
  }

  // Get payout ledger entries
  const ledgerQuery: any = {
    storeId: storeObjId,
    entityType,
    entityId,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const ledgerEntries = await PayoutLedger.find(ledgerQuery).lean();

  // Calculate expenses (payouts + refunds)
  const payouts = ledgerEntries
    .filter((e) => e.amount > 0 && e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0);

  const refunds = Math.abs(
    ledgerEntries
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const totalExpenses = payouts + refunds;
  const netProfit = totalRevenue - totalExpenses;

  // Get order count
  const orderIds = relevantSplits.map((s) => s.orderId);
  const orderCount = new Set(orderIds).size;

  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  return {
    entityType,
    entityId,
    period: {
      start: startDate,
      end: endDate,
    },
    revenue: {
      total: Math.round(totalRevenue * 100) / 100,
      fromOrders: Math.round(totalRevenue * 100) / 100,
      fromOther: 0, // Can be extended for other revenue sources
    },
    expenses: {
      total: Math.round(totalExpenses * 100) / 100,
      payouts: Math.round(payouts * 100) / 100,
      refunds: Math.round(refunds * 100) / 100,
      other: 0, // Can be extended for other expenses
    },
    netProfit: Math.round(netProfit * 100) / 100,
    orderCount,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    currency: 'USD', // TODO: Get from store config
  };
}

/**
 * Generate tax summary report
 */
export async function generateTaxSummaryReport(
  entityType: 'supplier' | 'reseller' | 'platform' | 'all',
  entityId: string | undefined,
  storeId: string,
  startDate: Date,
  endDate: Date,
  taxType: 'gst' | 'vat' | 'all' = 'all'
): Promise<TaxSummaryReport> {
  const storeObjId = new mongoose.Types.ObjectId(storeId);

  // Build invoice query
  const invoiceQuery: any = {
    storeId: storeObjId,
    issuedAt: { $gte: startDate, $lte: endDate },
    status: 'issued',
  };

  if (entityType !== 'all') {
    invoiceQuery.invoiceType = entityType;
    if (entityId) {
      invoiceQuery.entityId = entityId;
    }
  }

  if (taxType !== 'all') {
    invoiceQuery.taxType = taxType;
  }

  const invoices = await Invoice.find(invoiceQuery).lean();

  // Calculate totals
  const totalSales = invoices.reduce((sum, inv) => sum + inv.subtotal, 0);
  const totalTaxCollected = invoices.reduce((sum, inv) => sum + inv.taxAmount, 0);

  // Get credit notes (negative tax)
  const creditNoteQuery: any = {
    storeId: storeObjId,
    issuedAt: { $gte: startDate, $lte: endDate },
    status: 'issued',
  };

  if (entityType !== 'all' && entityId) {
    creditNoteQuery.entityType = entityType;
    creditNoteQuery.entityId = entityId;
  }

  const creditNotes = await CreditNote.find(creditNoteQuery).lean();
  const totalTaxRefunded = Math.abs(creditNotes.reduce((sum, cn) => sum + cn.taxAmount, 0));

  const netTaxLiability = totalTaxCollected - totalTaxRefunded;

  // Tax breakdown
  const breakdown: any = {};
  invoices.forEach((inv) => {
    if (inv.taxBreakdown) {
      if (inv.taxBreakdown.cgst) breakdown.cgst = (breakdown.cgst || 0) + inv.taxBreakdown.cgst;
      if (inv.taxBreakdown.sgst) breakdown.sgst = (breakdown.sgst || 0) + inv.taxBreakdown.sgst;
      if (inv.taxBreakdown.igst) breakdown.igst = (breakdown.igst || 0) + inv.taxBreakdown.igst;
      if (inv.taxBreakdown.vat) breakdown.vat = (breakdown.vat || 0) + inv.taxBreakdown.vat;
    }
  });

  // Monthly breakdown
  const byMonth: any[] = [];
  const monthMap = new Map<string, { sales: number; taxCollected: number; orderCount: number }>();

  invoices.forEach((inv) => {
    const monthKey = `${inv.issuedAt.getFullYear()}-${String(inv.issuedAt.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(monthKey) || { sales: 0, taxCollected: 0, orderCount: 0 };
    existing.sales += inv.subtotal;
    existing.taxCollected += inv.taxAmount;
    existing.orderCount += 1;
    monthMap.set(monthKey, existing);
  });

  monthMap.forEach((data, month) => {
    byMonth.push({
      month,
      sales: Math.round(data.sales * 100) / 100,
      taxCollected: Math.round(data.taxCollected * 100) / 100,
      orderCount: data.orderCount,
    });
  });

  byMonth.sort((a, b) => a.month.localeCompare(b.month));

  return {
    entityType,
    entityId,
    period: {
      start: startDate,
      end: endDate,
    },
    taxType,
    summary: {
      totalSales: Math.round(totalSales * 100) / 100,
      totalTaxCollected: Math.round(totalTaxCollected * 100) / 100,
      totalTaxPaid: Math.round(totalTaxRefunded * 100) / 100,
      netTaxLiability: Math.round(netTaxLiability * 100) / 100,
      orderCount: invoices.length,
    },
    breakdown: {
      cgst: breakdown.cgst ? Math.round(breakdown.cgst * 100) / 100 : undefined,
      sgst: breakdown.sgst ? Math.round(breakdown.sgst * 100) / 100 : undefined,
      igst: breakdown.igst ? Math.round(breakdown.igst * 100) / 100 : undefined,
      vat: breakdown.vat ? Math.round(breakdown.vat * 100) / 100 : undefined,
    },
    byMonth,
  };
}

/**
 * Generate revenue breakdown report
 */
export async function generateRevenueBreakdown(
  entityType: 'supplier' | 'reseller' | 'platform',
  entityId: string,
  storeId: string,
  startDate: Date,
  endDate: Date
): Promise<RevenueBreakdown> {
  const storeObjId = new mongoose.Types.ObjectId(storeId);

  // Get payment splits
  const splits = await PaymentSplit.find({
    storeId: storeObjId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  // Filter by entity
  let relevantSplits: any[] = [];
  if (entityType === 'supplier') {
    relevantSplits = splits.filter((s) => s.supplierId.toString() === entityId);
  } else if (entityType === 'reseller') {
    relevantSplits = splits.filter((s) => s.resellerId === entityId);
  } else if (entityType === 'platform') {
    relevantSplits = splits;
  }

  // Calculate by payment method
  const byPaymentMethod: any = {
    stripe: { revenue: 0, orderCount: 0 },
    paypal: { revenue: 0, orderCount: 0 },
    cod: { revenue: 0, orderCount: 0 },
  };

  const orderIds = new Set<string>();

  relevantSplits.forEach((split) => {
    let amount = 0;
    if (entityType === 'supplier') amount = split.supplierAmount;
    else if (entityType === 'reseller') amount = split.resellerAmount;
    else if (entityType === 'platform') amount = split.platformAmount;

    const method = split.paymentMethod || 'stripe';
    if (byPaymentMethod[method]) {
      byPaymentMethod[method].revenue += amount;
      byPaymentMethod[method].orderCount += 1;
    }
    orderIds.add(split.orderId);
  });

  // Round payment method totals
  Object.keys(byPaymentMethod).forEach((method) => {
    byPaymentMethod[method].revenue = Math.round(byPaymentMethod[method].revenue * 100) / 100;
  });

  // Get payout ledger status breakdown
  const ledgerQuery: any = {
    storeId: storeObjId,
    entityType,
    entityId,
    createdAt: { $gte: startDate, $lte: endDate },
    amount: { $gt: 0 }, // Only positive amounts
  };

  const ledgerEntries = await PayoutLedger.find(ledgerQuery).lean();

  const byStatus = {
    pending: ledgerEntries.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0),
    eligible: ledgerEntries.filter((e) => e.status === 'eligible').reduce((sum, e) => sum + e.amount, 0),
    paid: ledgerEntries.filter((e) => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0),
  };

  Object.keys(byStatus).forEach((status) => {
    (byStatus as any)[status] = Math.round((byStatus as any)[status] * 100) / 100;
  });

  // Daily trends
  const trendsMap = new Map<string, { revenue: number; orderCount: number }>();

  relevantSplits.forEach((split) => {
    const dateKey = split.createdAt.toISOString().split('T')[0];
    const existing = trendsMap.get(dateKey) || { revenue: 0, orderCount: 0 };

    let amount = 0;
    if (entityType === 'supplier') amount = split.supplierAmount;
    else if (entityType === 'reseller') amount = split.resellerAmount;
    else if (entityType === 'platform') amount = split.platformAmount;

    existing.revenue += amount;
    existing.orderCount += 1;
    trendsMap.set(dateKey, existing);
  });

  const trends = Array.from(trendsMap.entries())
    .map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orderCount: data.orderCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    entityType,
    entityId,
    period: {
      start: startDate,
      end: endDate,
    },
    byPaymentMethod,
    byStatus,
    trends,
  };
}

/**
 * Generate consolidated financial report (all entities)
 */
export async function generateConsolidatedReport(
  storeId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  period: { start: Date; end: Date };
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  byEntity: {
    suppliers: number;
    resellers: number;
    platform: number;
  };
  orderCount: number;
  taxSummary: TaxSummaryReport;
}> {
  const storeObjId = new mongoose.Types.ObjectId(storeId);

  // Get all splits in period
  const splits = await PaymentSplit.find({
    storeId: storeObjId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  const totalRevenue = splits.reduce((sum, s) => sum + s.totalAmount, 0);

  // Get all payouts
  const payouts = await PayoutLedger.find({
    storeId: storeObjId,
    createdAt: { $gte: startDate, $lte: endDate },
    amount: { $gt: 0 },
    status: 'paid',
  }).lean();

  const totalExpenses = payouts.reduce((sum, p) => sum + p.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // By entity
  const supplierRevenue = splits.reduce((sum, s) => sum + s.supplierAmount, 0);
  const resellerRevenue = splits.reduce((sum, s) => sum + s.resellerAmount, 0);
  const platformRevenue = splits.reduce((sum, s) => sum + s.platformAmount, 0);

  const orderCount = new Set(splits.map((s) => s.orderId)).size;

  // Tax summary
  const taxSummary = await generateTaxSummaryReport('all', undefined, storeId, startDate, endDate, 'all');

  return {
    period: { start: startDate, end: endDate },
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    byEntity: {
      suppliers: Math.round(supplierRevenue * 100) / 100,
      resellers: Math.round(resellerRevenue * 100) / 100,
      platform: Math.round(platformRevenue * 100) / 100,
    },
    orderCount,
    taxSummary,
  };
}

