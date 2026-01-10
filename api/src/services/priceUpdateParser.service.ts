import fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

/**
 * Price Update Parser Service
 * 
 * PURPOSE:
 * - Parse CSV/XLSX files for price updates (SKU + price only)
 * - Normalize column names (flexible mapping)
 * - Return structured rows with validation-ready data
 */

export interface ParsedPriceUpdateRow {
  rowNumber: number; // 1-indexed
  rawData: Record<string, any>; // Original row data
  normalizedData: {
    sku?: string;
    newPrice?: number;
  };
  errors: string[]; // Parsing errors (not validation errors)
}

export interface ParseResult {
  rows: ParsedPriceUpdateRow[];
  totalRows: number;
  parseErrors: string[]; // File-level parsing errors
}

// Column name mappings (case-insensitive, flexible)
const COLUMN_MAPPINGS: Record<string, string> = {
  // SKU
  'sku': 'sku',
  'product sku': 'sku',
  'product_sku': 'sku',
  'item code': 'sku',
  'itemcode': 'sku',
  'product code': 'sku',
  
  // Price
  'price': 'newPrice',
  'new price': 'newPrice',
  'newprice': 'newPrice',
  'cost price': 'newPrice',
  'costprice': 'newPrice',
  'cost': 'newPrice',
  'supplier price': 'newPrice',
  'supplierprice': 'newPrice',
};

/**
 * Normalize column names to standard format
 */
const normalizeColumnName = (columnName: string): string => {
  const normalized = columnName.trim().toLowerCase().replace(/\s+/g, ' ');
  return COLUMN_MAPPINGS[normalized] || columnName;
};

/**
 * Parse a single row and normalize data
 */
const parseRow = (row: Record<string, any>, rowNumber: number): ParsedPriceUpdateRow => {
  const errors: string[] = [];
  const normalized: ParsedPriceUpdateRow['normalizedData'] = {};
  
  // Normalize all column names
  const normalizedRow: Record<string, any> = {};
  Object.keys(row).forEach(key => {
    const normalizedKey = normalizeColumnName(key);
    normalizedRow[normalizedKey] = row[key];
  });
  
  // Extract SKU
  if (normalizedRow.sku) {
    normalized.sku = String(normalizedRow.sku).trim().toUpperCase();
  }
  
  // Extract newPrice
  if (normalizedRow.newPrice !== undefined && normalizedRow.newPrice !== null && normalizedRow.newPrice !== '') {
    const price = parseFloat(String(normalizedRow.newPrice));
    if (!isNaN(price)) {
      normalized.newPrice = price;
    } else {
      errors.push(`Invalid price: ${normalizedRow.newPrice}`);
    }
  }
  
  return {
    rowNumber,
    rawData: row,
    normalizedData: normalized,
    errors,
  };
};

/**
 * Parse CSV file
 */
export const parsePriceUpdateCSV = (filePath: string): ParseResult => {
  const parseErrors: string[] = [];
  const rows: ParsedPriceUpdateRow[] = [];
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: false, // Keep as strings, we'll parse manually
    }) as Record<string, any>[];
    
    records.forEach((record, index) => {
      const parsedRow = parseRow(record, index + 1); // 1-indexed
      rows.push(parsedRow);
    });
  } catch (error: any) {
    parseErrors.push(`Failed to parse CSV: ${error.message}`);
  }
  
  return {
    rows,
    totalRows: rows.length,
    parseErrors,
  };
};

/**
 * Parse XLSX file
 */
export const parsePriceUpdateXLSX = (filePath: string): ParseResult => {
  const parseErrors: string[] = [];
  const rows: ParsedPriceUpdateRow[] = [];
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      parseErrors.push('No worksheet found in XLSX file');
      return { rows, totalRows: 0, parseErrors };
    }
    
    const records = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false, // Convert all to strings
    }) as Record<string, any>[];
    
    records.forEach((record, index) => {
      const parsedRow = parseRow(record, index + 1); // 1-indexed
      rows.push(parsedRow);
    });
  } catch (error: any) {
    parseErrors.push(`Failed to parse XLSX: ${error.message}`);
  }
  
  return {
    rows,
    totalRows: rows.length,
    parseErrors,
  };
};

/**
 * Main parser function - determines file type and parses accordingly
 */
export const parsePriceUpdateFile = (filePath: string, fileType: 'csv' | 'xlsx'): ParseResult => {
  if (fileType === 'csv') {
    return parsePriceUpdateCSV(filePath);
  } else if (fileType === 'xlsx') {
    return parsePriceUpdateXLSX(filePath);
  } else {
    return {
      rows: [],
      totalRows: 0,
      parseErrors: [`Unsupported file type: ${fileType}`],
    };
  }
};

