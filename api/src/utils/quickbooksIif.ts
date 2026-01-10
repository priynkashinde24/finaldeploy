/**
 * QuickBooks IIF (Intuit Interchange Format) Utilities
 * 
 * IIF Format:
 * - Tab-delimited text file
 * - First line: Header row with transaction type
 * - Subsequent lines: Transaction data
 * - Uses specific column order for each transaction type
 */

export interface IIFTransaction {
  type: 'INV' | 'SPL' | 'DEP'; // Invoice, Split, Deposit
  date: Date;
  account: string;
  name: string;
  memo: string;
  amount: number;
  class?: string;
  cleared?: string;
}

/**
 * Format date for QuickBooks IIF (MM/DD/YY)
 */
export function quickbooksDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

/**
 * Escape IIF special characters
 */
export function escapeIif(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\r/g, '') // Remove carriage returns
    .trim();
}

/**
 * Format amount for IIF (negative for credits, positive for debits)
 */
export function iifAmount(amount: number, isCredit: boolean = false): string {
  const value = isCredit ? -Math.abs(amount) : Math.abs(amount);
  return value.toFixed(2);
}

/**
 * Build IIF header row for Invoice transactions
 */
export function buildInvoiceHeader(): string {
  return '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tCLEAR\tTOPRINT\tNAMEISTAXABLE\tADDR1\tADDR2\tADDR3\tADDR4\tADDR5\tDUEDATE\tTERMS\tPAID\tSHIPVIA\tSHIPDATE\tMEMO';
}

/**
 * Build IIF header row for Split transactions (line items)
 */
export function buildSplitHeader(): string {
  return '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tCLEAR\tQNTY\tPRICE\tINVITEM\tPAYMETH\tTAXABLE\tREIMBEXP\tEXTRA\tNAMEISTAXABLE\tADDR1\tADDR2\tADDR3\tADDR4\tADDR5\tDUEDATE\tTERMS\tPAID\tSHIPVIA\tSHIPDATE\tMEMO';
}

/**
 * Build IIF header row for Deposit transactions (receipts)
 */
export function buildDepositHeader(): string {
  return '!DEPOSIT\tDATE\tDEPACCT\tDEPAMT\tMEMO';
}

/**
 * Build IIF end transaction marker
 */
export function buildEndTransaction(): string {
  return '!ENDTRNS';
}

/**
 * Build Invoice transaction row
 */
export function buildInvoiceRow(params: {
  date: Date;
  account: string;
  name: string;
  amount: number;
  docNum: string;
  memo?: string;
  dueDate?: Date;
  terms?: string;
}): string {
  const { date, account, name, amount, docNum, memo, dueDate, terms } = params;
  const fields = [
    'TRNS', // Transaction type
    'INVOICE', // Transaction subtype
    quickbooksDate(date),
    escapeIif(account),
    escapeIif(name),
    iifAmount(amount, false), // Positive for invoice (debit to customer)
    escapeIif(docNum),
    'N', // Cleared
    'N', // To Print
    'N', // Name is Taxable
    '', // Addr1
    '', // Addr2
    '', // Addr3
    '', // Addr4
    '', // Addr5
    dueDate ? quickbooksDate(dueDate) : '',
    escapeIif(terms || ''),
    'N', // Paid
    '', // Ship Via
    '', // Ship Date
    escapeIif(memo || ''),
  ];
  return fields.join('\t');
}

/**
 * Build Split transaction row (line item)
 */
export function buildSplitRow(params: {
  date: Date;
  account: string;
  name: string;
  amount: number;
  docNum: string;
  memo?: string;
  item?: string;
  quantity?: number;
  price?: number;
}): string {
  const { date, account, name, amount, docNum, memo, item, quantity, price } = params;
  const fields = [
    'SPL', // Split line
    'INVOICE', // Transaction subtype
    quickbooksDate(date),
    escapeIif(account),
    escapeIif(name),
    iifAmount(amount, true), // Negative for split (credit to sales account)
    escapeIif(docNum),
    'N', // Cleared
    quantity ? quantity.toString() : '',
    price ? price.toFixed(2) : '',
    escapeIif(item || ''),
    '', // Pay Meth
    'N', // Taxable
    'N', // Reimb Exp
    '', // Extra
    'N', // Name is Taxable
    '', // Addr1-5
    '',
    '',
    '',
    '',
    '', // Due Date
    '', // Terms
    'N', // Paid
    '', // Ship Via
    '', // Ship Date
    escapeIif(memo || ''),
  ];
  return fields.join('\t');
}

/**
 * Build Deposit transaction row (for receipts)
 */
export function buildDepositRow(params: {
  date: Date;
  depositAccount: string;
  amount: number;
  memo?: string;
}): string {
  const { date, depositAccount, amount, memo } = params;
  const fields = [
    quickbooksDate(date),
    escapeIif(depositAccount),
    iifAmount(amount, false),
    escapeIif(memo || ''),
  ];
  return fields.join('\t');
}

/**
 * Build complete IIF file content
 */
export function buildIifFile(transactions: string[]): string {
  const lines: string[] = [];
  
  // Add headers if we have invoice transactions
  if (transactions.some(t => t.startsWith('TRNS'))) {
    lines.push(buildInvoiceHeader());
    lines.push(buildSplitHeader());
  }
  
  // Add deposit header if we have deposit transactions
  if (transactions.some(t => t.startsWith('!DEPOSIT'))) {
    lines.push(buildDepositHeader());
  }
  
  // Add transactions
  lines.push(...transactions);
  
  return lines.join('\n');
}

