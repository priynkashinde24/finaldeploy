import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for KYC document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'kyc');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `kyc-${uniqueSuffix}${ext}`);
  },
});

// File filter for KYC documents
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.includes(ext);
  
  if (isValidMimeType && isValidExtension) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
  }
};

// Multer configuration for KYC uploads
export const kycUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Helper function to mask Aadhaar number (show first 4 and last 4 digits)
export const maskAadhaar = (aadhaar: string): string => {
  // Remove any spaces or dashes
  const cleaned = aadhaar.replace(/\s|-/g, '');
  
  // Validate it's 12 digits
  if (!/^\d{12}$/.test(cleaned)) {
    throw new Error('Invalid Aadhaar number. Must be 12 digits.');
  }
  
  // Mask middle 4 digits: XXXX****XXXX
  return `${cleaned.substring(0, 4)}****${cleaned.substring(8, 12)}`;
};

// Helper function to get file URL
// Uses secure authenticated route instead of public static files
// In production, this should upload to S3/Cloudinary and return public URL
export const getFileUrl = (filename: string): string => {
  // Use secure authenticated route for file access
  const apiBaseUrl = process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5000';
  return `${apiBaseUrl}/api/kyc/files/${filename}`;
};

