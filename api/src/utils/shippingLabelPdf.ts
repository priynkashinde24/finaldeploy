import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

/**
 * Enhanced Shipping Label PDF Generator
 * 
 * PURPOSE:
 * - Generate printable shipping labels (PDF) with barcode/QR
 * - Include courier, address, order, barcode info
 * - A6 / 4x6 inch layout
 * - High-contrast print-friendly design
 */

export interface ShippingLabelPdfData {
  labelNumber: string;
  orderNumber: string;
  orderId: string;
  courierName: string;
  courierCode: string;
  pickupAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
  deliveryAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
  packageDetails: {
    weight: number;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
    };
  };
  orderDetails?: {
    orderNumber: string;
    orderId: string;
    itemCount: number;
    codAmount?: number | null;
    prepaidAmount?: number | null;
  };
  awbNumber?: string | null;
  outputPath: string;
}

/**
 * Generate QR code as base64 image
 */
async function generateQRCode(data: string): Promise<string | null> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 1,
      width: 150,
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR code generation failed:', error);
    return null;
  }
}

/**
 * Generate shipping label PDF
 */
export async function generateShippingLabelPdf(
  data: ShippingLabelPdfData
): Promise<string> {
  const { outputPath } = data;

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create PDF document (4x6 inches = A6 size)
  // 4 inches = 288 points, 6 inches = 432 points (at 72 DPI)
  const doc = new PDFDocument({
    size: [288, 432], // 4x6 inches in points
    margins: { top: 15, bottom: 15, left: 15, right: 15 },
  });

  // Pipe to file
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Header: Store Logo (placeholder)
  doc.fontSize(10).font('Helvetica-Bold').text('SHIPPING LABEL', { align: 'center' });
  doc.moveDown(0.5);

  // Courier Badge
  const paymentType = data.orderDetails?.codAmount ? 'COD' : 'PREPAID';
  doc.fontSize(8)
    .font('Helvetica-Bold')
    .fillColor(paymentType === 'COD' ? 'red' : 'green')
    .text(paymentType, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(0.5);

  // Courier Name
  doc.fontSize(12).font('Helvetica-Bold').text(data.courierName.toUpperCase(), { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(8).font('Helvetica').text(`Label: ${data.labelNumber}`, { align: 'center' });
  if (data.awbNumber) {
    doc.fontSize(8).font('Helvetica').text(`AWB: ${data.awbNumber}`, { align: 'center' });
  }
  doc.moveDown(0.5);

  // Order Number
  doc.fontSize(9).font('Helvetica-Bold').text(`Order: ${data.orderNumber}`, { align: 'center' });
  doc.moveDown(0.5);

  // FROM Address
  doc.fontSize(8).font('Helvetica-Bold').text('FROM:', { underline: true });
  doc.font('Helvetica').fontSize(7);
  doc.text(data.pickupAddress.name);
  doc.text(data.pickupAddress.street);
  doc.text(`${data.pickupAddress.city}, ${data.pickupAddress.state} ${data.pickupAddress.zip}`);
  doc.text(data.pickupAddress.country);
  if (data.pickupAddress.phone) {
    doc.text(`Ph: ${data.pickupAddress.phone}`);
  }
  doc.moveDown(0.5);

  // TO Address
  doc.fontSize(8).font('Helvetica-Bold').text('TO:', { underline: true });
  doc.font('Helvetica').fontSize(7);
  doc.text(data.deliveryAddress.name);
  doc.text(data.deliveryAddress.street);
  doc.text(`${data.deliveryAddress.city}, ${data.deliveryAddress.state} ${data.deliveryAddress.zip}`);
  doc.text(data.deliveryAddress.country);
  if (data.deliveryAddress.phone) {
    doc.text(`Ph: ${data.deliveryAddress.phone}`);
  }
  doc.moveDown(0.5);

  // Package Details
  doc.fontSize(7).font('Helvetica');
  doc.text(`Weight: ${data.packageDetails.weight} kg`);
  if (data.packageDetails.dimensions) {
    const dims = data.packageDetails.dimensions;
    if (dims.length && dims.width && dims.height) {
      doc.text(`Dimensions: ${dims.length} x ${dims.width} x ${dims.height} cm`);
    }
  }
  if (data.orderDetails) {
    doc.text(`Items: ${data.orderDetails.itemCount}`);
    // COD Amount (if COD)
    if (data.orderDetails.codAmount) {
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('red');
      doc.text(`COD Amount: ₹${data.orderDetails.codAmount.toFixed(2)}`, { align: 'center' });
      doc.fillColor('black');
    }
  }

  // Barcode/QR Code Area
  doc.moveDown(0.5);
  const barcodeY = doc.y;
  const qrCodeSize = 80;
  const barcodeWidth = 200;
  const barcodeHeight = 60;

  // Generate QR code (encode orderId or awbNumber if available)
  const qrData = data.awbNumber || data.orderId;
  const qrCodeDataUrl = await generateQRCode(qrData);

  if (qrCodeDataUrl) {
    // Embed QR code image
    const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
    const qrCodeX = (288 - qrCodeSize) / 2; // Center horizontally
    doc.image(qrCodeBuffer, qrCodeX, doc.y, { width: qrCodeSize, height: qrCodeSize });
    doc.y += qrCodeSize + 5;
    
    // QR code label
    doc.fontSize(6).font('Helvetica').text(qrData, {
      width: barcodeWidth,
      align: 'center',
    });
  } else {
    // Fallback: Text-based barcode
    doc.fontSize(6).font('Helvetica').text('BARCODE:', { align: 'center' });
    doc.moveDown(0.2);
    doc.rect(44, doc.y, barcodeWidth, barcodeHeight).stroke();
    doc.fontSize(8).font('Helvetica-Bold').text(data.orderId, 44, doc.y + 15, {
      width: barcodeWidth,
      align: 'center',
    });
    doc.fontSize(6).font('Helvetica').text(data.labelNumber, 44, doc.y + 30, {
      width: barcodeWidth,
      align: 'center',
    });
    doc.y = barcodeY + barcodeHeight + 5;
  }

  // Footer
  doc.fontSize(6).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, {
    align: 'center',
  });

  // Finalize PDF
  doc.end();

  // Wait for stream to finish
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      resolve(outputPath);
    });
    stream.on('error', reject);
  });
}

