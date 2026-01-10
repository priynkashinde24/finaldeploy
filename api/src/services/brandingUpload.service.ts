import path from 'path';

const ALLOWED = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// Placeholder: replace with actual S3/Cloudinary/Vercel Blob upload
export async function uploadBrandAsset(file: { originalname: string; buffer?: Buffer; size?: number; url?: string }) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED.includes(ext)) {
    throw new Error('Invalid file type');
  }
  if (file.size && file.size > MAX_SIZE_BYTES) {
    throw new Error('File too large');
  }

  // For now, assume file.url is already a safe public URL (caller to supply)
  if (file.url) {
    return file.url;
  }

  // In real implementation, upload buffer to storage and return public URL
  throw new Error('Upload backend not implemented');
}


