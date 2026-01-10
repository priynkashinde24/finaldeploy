import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { parseCSV, parseXLSX, validateRow, convertRowToProduct, ParsedRow } from '../utils/fileParser';

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `catalog-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and XLSX files are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const uploadCatalog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    const supplierId = req.body.supplierId || 'default-supplier'; // In production, get from auth
    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    let rows: ParsedRow[] = [];

    // Parse file based on extension
    try {
      if (fileExt === '.csv') {
        rows = parseCSV(filePath);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        rows = parseXLSX(filePath);
      } else {
        sendError(res, 'Unsupported file format', 400);
        return;
      }
    } catch (parseError: any) {
      // Clean up file
      fs.unlinkSync(filePath);
      sendError(res, `Failed to parse file: ${parseError.message}`, 400);
      return;
    }

    if (rows.length === 0) {
      // Clean up file
      fs.unlinkSync(filePath);
      sendError(res, 'File is empty or contains no valid data', 400);
      return;
    }

    // Validate and convert rows
    const validProducts: any[] = [];
    const failedRecords: Array<{ row: number; data: ParsedRow; errors: string[] }> = [];

    rows.forEach((row, index) => {
      const validation = validateRow(row, index);
      
      if (!validation.isValid) {
        failedRecords.push({
          row: index + 1,
          data: row,
          errors: validation.errors,
        });
        return;
      }

      const product = convertRowToProduct(row, supplierId);
      if (product) {
        validProducts.push(product);
      } else {
        failedRecords.push({
          row: index + 1,
          data: row,
          errors: ['Failed to convert row to product'],
        });
      }
    });

    // Insert valid products into database
    let insertedCount = 0;
    let insertErrors: any[] = [];

    if (validProducts.length > 0) {
      try {
        // Use insertMany with ordered: false to continue on errors
        const result = await Product.insertMany(validProducts, {
          ordered: false,
        });
        insertedCount = result.length;
      } catch (insertError: any) {
        // Handle duplicate key errors and other insert errors
        if (insertError.writeErrors) {
          insertErrors = insertError.writeErrors.map((err: any) => ({
            row: err.index + 1,
            error: err.errmsg || err.message,
          }));
          insertedCount = insertError.insertedCount || 0;
        } else {
          throw insertError;
        }
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkError) {
      console.error('Failed to delete temp file:', unlinkError);
    }

    // Combine validation failures with insert errors
    const allFailedRecords = [
      ...failedRecords,
      ...insertErrors.map((err) => ({
        row: err.row,
        data: rows[err.row - 1] || {},
        errors: [err.error],
      })),
    ];

    sendSuccess(
      res,
      {
        insertedCount,
        failedCount: allFailedRecords.length,
        totalRows: rows.length,
        failedRecords: allFailedRecords,
      },
      `Upload completed: ${insertedCount} products inserted, ${allFailedRecords.length} failed`
    );
  } catch (error) {
    // Clean up file if still exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete temp file:', unlinkError);
      }
    }
    next(error);
  }
};

