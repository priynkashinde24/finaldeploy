/**
 * Xero CSV Export Utilities
 * 
 * Xero uses CSV format for importing invoices and payments.
 * 
 * Invoice CSV Format:
 * - ContactName, EmailAddress, POAddressLine1-4, POCity, PORegion, POPostalCode, POCountry
 * - InvoiceNumber, Reference, InvoiceDate, DueDate
 * - InventoryItemCode, Description, Quantity, UnitAmount, DiscountRate, AccountCode, TaxType
 * - TrackingName1, TrackingOption1, Currency, BrandingTheme, Status
 * 
 * Payment CSV Format:
 * - InvoiceNumber, AccountCode, Date, Amount, Reference, Currency
 */

export interface XeroInvoiceLine {
  contactName: string;
  emailAddress?: string;
  invoiceNumber: string;
  reference?: string;
  invoiceDate: string; // DD/MM/YYYY
  dueDate?: string; // DD/MM/YYYY
  inventoryItemCode?: string;
  description: string;
  quantity?: number;
  unitAmount: number;
  discountRate?: number;
  accountCode: string;
  taxType?: string;
  currency?: string;
  status?: string;
}

export interface XeroPayment {
  invoiceNumber: string;
  accountCode: string;
  date: string; // DD/MM/YYYY
  amount: number;
  reference?: string;
  currency?: string;
}

/**
 * Format date for Xero CSV (DD/MM/YYYY)
 */
export function xeroDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Escape CSV value (handles quotes and commas)
 */
export function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build CSV row from array of values
 */
export function buildCsvRow(values: any[]): string {
  return values.map(escapeCsv).join(',');
}

/**
 * Build Xero Invoice CSV header
 */
export function buildInvoiceHeader(): string {
  return buildCsvRow([
    'ContactName',
    'EmailAddress',
    'POAddressLine1',
    'POAddressLine2',
    'POAddressLine3',
    'POAddressLine4',
    'POCity',
    'PORegion',
    'POPostalCode',
    'POCountry',
    'InvoiceNumber',
    'Reference',
    'InvoiceDate',
    'DueDate',
    'InventoryItemCode',
    'Description',
    'Quantity',
    'UnitAmount',
    'DiscountRate',
    'AccountCode',
    'TaxType',
    'TrackingName1',
    'TrackingOption1',
    'Currency',
    'BrandingTheme',
    'Status',
  ]);
}

/**
 * Build Xero Invoice CSV row
 */
export function buildInvoiceRow(line: XeroInvoiceLine): string {
  return buildCsvRow([
    line.contactName,
    line.emailAddress || '',
    '', // POAddressLine1
    '', // POAddressLine2
    '', // POAddressLine3
    '', // POAddressLine4
    '', // POCity
    '', // PORegion
    '', // POPostalCode
    '', // POCountry
    line.invoiceNumber,
    line.reference || '',
    line.invoiceDate,
    line.dueDate || '',
    line.inventoryItemCode || '',
    line.description,
    line.quantity !== undefined ? line.quantity : '',
    line.unitAmount.toFixed(2),
    line.discountRate !== undefined ? line.discountRate.toFixed(2) : '',
    line.accountCode,
    line.taxType || '',
    '', // TrackingName1
    '', // TrackingOption1
    line.currency || 'USD',
    '', // BrandingTheme
    line.status || 'AUTHORISED',
  ]);
}

/**
 * Build Xero Payment CSV header
 */
export function buildPaymentHeader(): string {
  return buildCsvRow([
    'InvoiceNumber',
    'AccountCode',
    'Date',
    'Amount',
    'Reference',
    'Currency',
  ]);
}

/**
 * Build Xero Payment CSV row
 */
export function buildPaymentRow(payment: XeroPayment): string {
  return buildCsvRow([
    payment.invoiceNumber,
    payment.accountCode,
    payment.date,
    payment.amount.toFixed(2),
    payment.reference || '',
    payment.currency || 'USD',
  ]);
}

/**
 * Build complete CSV file content
 */
export function buildCsvFile(headers: string[], rows: string[]): string {
  const lines: string[] = [];
  if (headers.length > 0) {
    lines.push(...headers);
  }
  lines.push(...rows);
  return lines.join('\n');
}

/**
 * Get tax type for Xero based on tax breakdown
 */
export function getXeroTaxType(taxBreakup: {
  cgst?: number;
  sgst?: number;
  igst?: number;
  vat?: number;
}): string {
  // Xero tax types vary by region
  // Common ones: GST, VAT, NONE, EXEMPT, EXEMPT EXPORT, etc.
  // For GST (India), we'll use GST
  // For VAT, we'll use VAT
  // Default to empty string and let user configure in Xero
  
  if (taxBreakup.cgst || taxBreakup.sgst || taxBreakup.igst) {
    return 'GST'; // Goods and Services Tax
  }
  if (taxBreakup.vat) {
    return 'VAT'; // Value Added Tax
  }
  return ''; // No tax or user-defined
}

