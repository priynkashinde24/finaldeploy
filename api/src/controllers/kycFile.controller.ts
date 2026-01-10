import { Request, Response, NextFunction } from 'express';
import { SupplierKYC } from '../models/SupplierKYC';
import { sendError } from '../utils/responseFormatter';
import * as path from 'path';
import * as fs from 'fs';
import { authenticate } from '../middleware/auth.middleware';

/**
 * GET /api/kyc/files/:filename
 * Secure file access - only authenticated users can access files
 * Suppliers can only access their own KYC files
 * Admins can access all KYC files
 */
export const getKYCFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { filename } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      sendError(res, 'Invalid filename', 400);
      return;
    }

    // Only allow files that start with 'kyc-'
    if (!filename.startsWith('kyc-')) {
      sendError(res, 'Invalid file', 400);
      return;
    }

    const filePath = path.join(process.cwd(), 'uploads', 'kyc', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      sendError(res, 'File not found', 404);
      return;
    }

    // Find KYC record that contains this file
    const kyc = await SupplierKYC.findOne({
      $or: [
        { 'documents.panCardUrl': { $regex: filename } },
        { 'documents.aadhaarFrontUrl': { $regex: filename } },
        { 'documents.aadhaarBackUrl': { $regex: filename } },
        { 'documents.gstCertificateUrl': { $regex: filename } },
      ],
    });

    if (!kyc) {
      sendError(res, 'KYC record not found', 404);
      return;
    }

    // Check access permissions
    if (currentUser.role === 'supplier') {
      // Suppliers can only access their own files
      if (kyc.supplierId.toString() !== currentUser.id) {
        sendError(res, 'Access denied', 403);
        return;
      }
    } else if (currentUser.role !== 'admin') {
      // Only suppliers and admins can access KYC files
      sendError(res, 'Access denied', 403);
      return;
    }

    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

