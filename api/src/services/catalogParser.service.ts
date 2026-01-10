import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

/**
 * Catalog Parser Service
 * 
 * PURPOSE:
 * - Parse CSV/XLSX files from supplier catalog uploads
 * - Normalize column names (flexible mapping)
 * - Return structured rows with validation-ready data
 */

export interface ParsedCatalogRow {
  rowNumber: number; // 1-indexed
  rawData: Record<string, any>; // Original row data
  normalizedData: {
    productName?: string;
    sku?: string;
    brand?: string;
    category?: string;
    variantAttributes?: Record<string, any>;
    costPrice?: number;
    stock?: number;
    minOrderQty?: number;
    description?: string;
    images?: string[];
  };
  errors: string[]; // Parsing errors (not validation errors)
}

export interface ParseResult {
  rows: ParsedCatalogRow[];
  totalRows: number;
  parseErrors: string[]; // File-level parsing errors
}

// Column name mappings (case-insensitive, flexible)
const COLUMN_MAPPINGS: Record<string, string> = {
  // Product name
  'product name': 'productName',
  'productname': 'productName',
  'name': 'productName',
  'product': 'productName',
  'title': 'productName',
  
  // SKU
  'sku': 'sku',
  'product sku': 'sku',
  'product_sku': 'sku',
  'item code': 'sku',
  'itemcode': 'sku',
  
  // Brand
  'brand': 'brand',
  'brand name': 'brand',
  'brandname': 'brand',
  'manufacturer': 'brand',
  
  // Category
  'category': 'category',
  'product category': 'category',
  'productcategory': 'category',
  'cat': 'category',
  
  // Cost Price
  'cost price': 'costPrice',
  'costprice': 'costPrice',
  'cost': 'costPrice',
  'price': 'costPrice',
  'supplier price': 'costPrice',
  'supplierprice': 'costPrice',
  
  // Stock
  'stock': 'stock',
  'quantity': 'stock',
  'qty': 'stock',
  'inventory': 'stock',
  'available': 'stock',
  
  // Min Order Qty
  'min order qty': 'minOrderQty',
  'minorderqty': 'minOrderQty',
  'min qty': 'minOrderQty',
  'minimum order': 'minOrderQty',
  'moq': 'minOrderQty',
  
  // Description
  'description': 'description',
  'desc': 'description',
  'details': 'description',
  
  // Images
  'images': 'images',
  'image': 'images',
  'image urls': 'images',
  'imageurls': 'images',
  'photos': 'images',
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
const parseRow = (row: Record<string, any>, rowNumber: number): ParsedCatalogRow => {
  const errors: string[] = [];
  const normalized: ParsedCatalogRow['normalizedData'] = {};
  
  // Normalize all column names
  const normalizedRow: Record<string, any> = {};
  Object.keys(row).forEach(key => {
    const normalizedKey = normalizeColumnName(key);
    normalizedRow[normalizedKey] = row[key];
  });
  
  // Extract productName
  if (normalizedRow.productName) {
    normalized.productName = String(normalizedRow.productName).trim();
  }
  
  // Extract SKU
  if (normalizedRow.sku) {
    normalized.sku = String(normalizedRow.sku).trim().toUpperCase();
  }
  
  // Extract brand
  if (normalizedRow.brand) {
    normalized.brand = String(normalizedRow.brand).trim();
  }
  
  // Extract category
  if (normalizedRow.category) {
    normalized.category = String(normalizedRow.category).trim();
  }
  
  // Extract costPrice
  if (normalizedRow.costPrice !== undefined && normalizedRow.costPrice !== null && normalizedRow.costPrice !== '') {
    const costPrice = parseFloat(String(normalizedRow.costPrice));
    if (!isNaN(costPrice)) {
      normalized.costPrice = costPrice;
    } else {
      errors.push(`Invalid cost price: ${normalizedRow.costPrice}`);
    }
  }
  
  // Extract stock
  if (normalizedRow.stock !== undefined && normalizedRow.stock !== null && normalizedRow.stock !== '') {
    const stock = parseFloat(String(normalizedRow.stock));
    if (!isNaN(stock)) {
      normalized.stock = Math.max(0, Math.floor(stock)); // Ensure non-negative integer
    } else {
      errors.push(`Invalid stock: ${normalizedRow.stock}`);
    }
  }
  
  // Extract minOrderQty
  if (normalizedRow.minOrderQty !== undefined && normalizedRow.minOrderQty !== null && normalizedRow.minOrderQty !== '') {
    const minOrderQty = parseFloat(String(normalizedRow.minOrderQty));
    if (!isNaN(minOrderQty) && minOrderQty >= 1) {
      normalized.minOrderQty = Math.floor(minOrderQty);
    }
  }
  
  // Extract description
  if (normalizedRow.description) {
    normalized.description = String(normalizedRow.description).trim();
  }
  
  // Extract images (comma-separated URLs)
  if (normalizedRow.images) {
    const imageStr = String(normalizedRow.images);
    normalized.images = imageStr
      .split(',')
      .map(img => img.trim())
      .filter(img => img.length > 0);
  }
  
  // Extract variant attributes (any columns not mapped above)
  const variantAttributes: Record<string, any> = {};
  Object.keys(normalizedRow).forEach(key => {
    if (!['productName', 'sku', 'brand', 'category', 'costPrice', 'stock', 'minOrderQty', 'description', 'images'].includes(key)) {
      const value = normalizedRow[key];
      if (value !== undefined && value !== null && value !== '') {
        variantAttributes[key] = String(value).trim();
      }
    }
  });
  
  if (Object.keys(variantAttributes).length > 0) {
    normalized.variantAttributes = variantAttributes;
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
export const parseCSVFile = (filePath: string): ParseResult => {
  const parseErrors: string[] = [];
  const rows: ParsedCatalogRow[] = [];
  
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
export const parseXLSXFile = (filePath: string): ParseResult => {
  const parseErrors: string[] = [];
  const rows: ParsedCatalogRow[] = [];
  
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
export const parseCatalogFile = (filePath: string, fileType: 'csv' | 'xlsx'): ParseResult => {
  if (fileType === 'csv') {
    return parseCSVFile(filePath);
  } else if (fileType === 'xlsx') {
    return parseXLSXFile(filePath);
  } else {
    return {
      rows: [],
      totalRows: 0,
      parseErrors: [`Unsupported file type: ${fileType}`],
    };
  }
};

