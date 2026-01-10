import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { IProduct } from '../models/Product';

export interface ParsedRow {
  sku?: string;
  name?: string;
  price?: string | number;
  cost?: string | number;
  quantity?: string | number;
  category?: string;
  description?: string;
  images?: string;
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const REQUIRED_COLUMNS = ['sku', 'name', 'price', 'quantity'];

export const validateRow = (row: ParsedRow, rowIndex: number): ValidationResult => {
  const errors: string[] = [];

  REQUIRED_COLUMNS.forEach((col) => {
    if (!row[col] || (typeof row[col] === 'string' && row[col].trim() === '')) {
      errors.push(`Row ${rowIndex + 1}: Missing required column '${col}'`);
    }
  });

  // Validate price
  if (row.price) {
    const price = parseFloat(String(row.price));
    if (isNaN(price) || price < 0) {
      errors.push(`Row ${rowIndex + 1}: Invalid price value`);
    }
  }

  // Validate quantity
  if (row.quantity) {
    const quantity = parseInt(String(row.quantity));
    if (isNaN(quantity) || quantity < 0) {
      errors.push(`Row ${rowIndex + 1}: Invalid quantity value`);
    }
  }

  // Validate cost (optional but must be valid if provided)
  if (row.cost !== undefined && row.cost !== null && row.cost !== '') {
    const cost = parseFloat(String(row.cost));
    if (isNaN(cost) || cost < 0) {
      errors.push(`Row ${rowIndex + 1}: Invalid cost value`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const parseCSV = (filePath: string): ParsedRow[] => {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: true,
  }) as ParsedRow[];

  return records;
};

export const parseXLSX = (filePath: string): ParsedRow[] => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  }) as ParsedRow[];

  return records;
};

export const convertRowToProduct = (
  row: ParsedRow,
  supplierId: string
): IProduct | null => {
  try {
    const product: Partial<IProduct> = {
      supplierId,
      name: String(row.name || '').trim(),
      description: row.description ? String(row.description).trim() : undefined,
      sku: String(row.sku || '').trim(),
      price: parseFloat(String(row.price || 0)),
      cost: row.cost ? parseFloat(String(row.cost)) : 0,
      quantity: parseInt(String(row.quantity || 0)),
      category: row.category ? String(row.category).trim() : 'Uncategorized',
      images: row.images
        ? String(row.images)
            .split(',')
            .map((img) => img.trim())
            .filter((img) => img.length > 0)
        : [],
      attributes: {},
      status: 'active' as const,
    };

    // Add any additional columns as attributes
    Object.keys(row).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (
        !['sku', 'name', 'price', 'cost', 'quantity', 'category', 'description', 'images'].includes(
          lowerKey
        )
      ) {
        product.attributes = product.attributes || {};
        product.attributes[key] = row[key];
      }
    });

    return product as IProduct;
  } catch (error) {
    return null;
  }
};

