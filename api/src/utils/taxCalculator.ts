import { IOrder } from '../models/Order';

/**
 * Tax Calculator Utility
 * 
 * PURPOSE:
 * - Calculate tax breakdown for invoices
 * - Support GST (CGST/SGST/IGST) and VAT
 * - Snapshot tax at invoice generation time
 * - Never recalculate later
 */

export interface TaxBreakdown {
  cgst?: number; // Central GST (for India, intra-state)
  sgst?: number; // State GST (for India, intra-state)
  igst?: number; // Integrated GST (for India, inter-state)
  vat?: number; // VAT amount
  totalTax: number;
}

export interface TaxCalculationResult {
  taxType: 'gst' | 'vat' | null;
  taxRate: number;
  taxAmount: number;
  taxBreakdown: TaxBreakdown;
  subtotal: number;
  totalWithTax: number;
}

/**
 * Calculate tax breakdown from order
 * 
 * PRIORITY:
 * 1. Use taxSnapshot if available (immutable, snapshot-based)
 * 2. Fallback to legacy taxType/taxRate/taxAmount fields
 * 
 * For GST (India):
 * - Intra-state: CGST + SGST (each = taxRate / 2)
 * - Inter-state: IGST (taxRate)
 * 
 * For VAT:
 * - Single VAT amount
 * 
 * @param order - Order document with tax information
 * @returns Tax calculation result
 */
export function calculateTaxFromOrder(order: IOrder): TaxCalculationResult {
  // PRIORITY 1: Use taxSnapshot if available (new tax engine)
  if (order.taxSnapshot) {
    const snapshot = order.taxSnapshot;
    const taxType = snapshot.taxType === 'GST' ? 'gst' : snapshot.taxType === 'VAT' ? 'vat' : null;
    
    // Calculate average tax rate from snapshot
    const taxRate = snapshot.taxableAmount > 0 
      ? (snapshot.totalTax / snapshot.taxableAmount) * 100 
      : 0;

    const taxBreakdown: TaxBreakdown = {
      cgst: snapshot.taxBreakup.cgst,
      sgst: snapshot.taxBreakup.sgst,
      igst: snapshot.taxBreakup.igst,
      vat: snapshot.taxBreakup.vat,
      totalTax: snapshot.totalTax,
    };

    const subtotal = snapshot.taxableAmount;
    const totalWithTax = subtotal + snapshot.totalTax + (order.shippingAmount || 0);

    return {
      taxType,
      taxRate: Math.round(taxRate * 100) / 100,
      taxAmount: snapshot.totalTax,
      taxBreakdown,
      subtotal,
      totalWithTax,
    };
  }

  // PRIORITY 2: Fallback to legacy fields
  const taxType = order.taxType || null;
  const taxRate = order.taxRate || 0;
  const subtotal = order.subtotal || order.totalAmount || 0;
  const taxAmount = order.taxAmount || 0;

  let taxBreakdown: TaxBreakdown = {
    totalTax: taxAmount,
  };

  if (taxType === 'gst') {
    // For GST, determine if intra-state or inter-state
    // For now, assume intra-state (can be enhanced based on shipping address)
    const isIntraState = true; // TODO: Determine based on seller and buyer state

    if (isIntraState) {
      // Intra-state: CGST + SGST (each is half of tax rate)
      const cgstRate = taxRate / 2;
      const sgstRate = taxRate / 2;
      taxBreakdown.cgst = Math.round((subtotal * cgstRate) / 100 * 100) / 100;
      taxBreakdown.sgst = Math.round((subtotal * sgstRate) / 100 * 100) / 100;
      taxBreakdown.totalTax = taxBreakdown.cgst + taxBreakdown.sgst;
    } else {
      // Inter-state: IGST
      taxBreakdown.igst = taxAmount;
      taxBreakdown.totalTax = taxAmount;
    }
  } else if (taxType === 'vat') {
    // VAT: Single tax amount
    taxBreakdown.vat = taxAmount;
    taxBreakdown.totalTax = taxAmount;
  }

  // Ensure totalTax matches taxAmount (handle rounding differences)
  if (Math.abs(taxBreakdown.totalTax - taxAmount) > 0.01) {
    // Adjust the largest component to match
    if (taxType === 'gst' && taxBreakdown.cgst && taxBreakdown.sgst) {
      const difference = taxAmount - taxBreakdown.totalTax;
      taxBreakdown.cgst = Math.round((taxBreakdown.cgst + difference / 2) * 100) / 100;
      taxBreakdown.sgst = taxAmount - taxBreakdown.cgst;
      taxBreakdown.totalTax = taxAmount;
    } else if (taxType === 'gst' && taxBreakdown.igst) {
      taxBreakdown.igst = taxAmount;
      taxBreakdown.totalTax = taxAmount;
    } else if (taxType === 'vat' && taxBreakdown.vat) {
      taxBreakdown.vat = taxAmount;
      taxBreakdown.totalTax = taxAmount;
    }
  }

  const totalWithTax = subtotal + taxAmount + (order.shippingAmount || 0);

  return {
    taxType,
    taxRate,
    taxAmount,
    taxBreakdown,
    subtotal,
    totalWithTax,
  };
}

/**
 * Calculate tax breakdown for a specific amount
 * 
 * @param amount - Base amount
 * @param taxType - Tax type (gst or vat)
 * @param taxRate - Tax rate percentage
 * @param isIntraState - For GST, whether intra-state (default: true)
 * @returns Tax breakdown
 */
export function calculateTaxBreakdown(
  amount: number,
  taxType: 'gst' | 'vat' | null,
  taxRate: number,
  isIntraState: boolean = true
): TaxBreakdown {
  const taxAmount = (amount * taxRate) / 100;
  const breakdown: TaxBreakdown = {
    totalTax: Math.round(taxAmount * 100) / 100,
  };

  if (taxType === 'gst') {
    if (isIntraState) {
      // Intra-state: CGST + SGST
      const cgstRate = taxRate / 2;
      const sgstRate = taxRate / 2;
      breakdown.cgst = Math.round((amount * cgstRate) / 100 * 100) / 100;
      breakdown.sgst = Math.round((amount * sgstRate) / 100 * 100) / 100;
      breakdown.totalTax = breakdown.cgst + breakdown.sgst;
    } else {
      // Inter-state: IGST
      breakdown.igst = Math.round(taxAmount * 100) / 100;
      breakdown.totalTax = breakdown.igst;
    }
  } else if (taxType === 'vat') {
    breakdown.vat = Math.round(taxAmount * 100) / 100;
    breakdown.totalTax = breakdown.vat;
  }

  return breakdown;
}

