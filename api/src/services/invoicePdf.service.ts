import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { IInvoice, IInvoiceLineItem } from '../models/Invoice';

/**
 * Invoice PDF Generation Service
 * 
 * PURPOSE:
 * - Generate professional invoice PDFs
 * - Include all required legal information
 * - Support GST/VAT tax breakdown
 * - Save to local storage (can be extended to S3/Cloudinary)
 */

export interface PdfGenerationOptions {
  outputPath?: string; // If not provided, generates in temp directory
  includeLogo?: boolean;
  logoPath?: string;
}

/**
 * Generate PDF for an invoice
 * 
 * @param invoice - Invoice document
 * @param options - PDF generation options
 * @returns Path to generated PDF file
 */
export async function generateInvoicePdf(
  invoice: IInvoice,
  options: PdfGenerationOptions = {}
): Promise<string> {
  const { outputPath, includeLogo = false, logoPath } = options;

  // Determine output path
  let pdfPath: string;
  if (outputPath) {
    pdfPath = outputPath;
  } else {
    // Generate in temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'invoices');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    pdfPath = path.join(tempDir, `${invoice.invoiceNumber}.pdf`);
  }

  // Ensure directory exists
  const dir = path.dirname(pdfPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create PDF document (A4 size)
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  // Pipe to file
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Header
  if (includeLogo && logoPath && fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 50, { width: 100 });
    doc.y = 160;
  } else {
    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 50, 50);
    doc.y = 80;
  }

  // Invoice number and date
  doc.fontSize(10).font('Helvetica');
  doc.text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'right' });
  doc.text(`Date: ${invoice.issuedAt.toLocaleDateString()}`, { align: 'right' });
  doc.moveDown();

  // Billing information
  const startY = doc.y;
  doc.fontSize(12).font('Helvetica-Bold').text('Bill From:', 50, startY);
  doc.fontSize(10).font('Helvetica');
  doc.text(invoice.billingFrom.name);
  if (invoice.billingFrom.address) {
    if (invoice.billingFrom.address.street) doc.text(invoice.billingFrom.address.street);
    if (invoice.billingFrom.address.city) {
      const cityLine = [
        invoice.billingFrom.address.city,
        invoice.billingFrom.address.state,
        invoice.billingFrom.address.zip,
      ]
        .filter(Boolean)
        .join(', ');
      doc.text(cityLine);
    }
    if (invoice.billingFrom.address.country) doc.text(invoice.billingFrom.address.country);
  }
  if (invoice.billingFrom.taxId) {
    doc.text(`Tax ID: ${invoice.billingFrom.taxId}`);
  }
  if (invoice.billingFrom.email) doc.text(`Email: ${invoice.billingFrom.email}`);

  // Bill To (right side)
  let billToY = startY;
  doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 300, billToY);
  billToY += 15;
  doc.fontSize(10).font('Helvetica');
  doc.text(invoice.billingTo.name, 300, billToY);
  billToY += 15;
  if (invoice.billingTo.address) {
    if (invoice.billingTo.address.street) {
      doc.text(invoice.billingTo.address.street, 300, billToY);
      billToY += 15;
    }
    if (invoice.billingTo.address.city) {
      const cityLine = [
        invoice.billingTo.address.city,
        invoice.billingTo.address.state,
        invoice.billingTo.address.zip,
      ]
        .filter(Boolean)
        .join(', ');
      doc.text(cityLine, 300, billToY);
      billToY += 15;
    }
    if (invoice.billingTo.address.country) {
      doc.text(invoice.billingTo.address.country, 300, billToY);
      billToY += 15;
    }
  }
  if (invoice.billingTo.taxId) {
    doc.text(`Tax ID: ${invoice.billingTo.taxId}`, 300, billToY);
    billToY += 15;
  }
  if (invoice.billingTo.email) {
    doc.text(`Email: ${invoice.billingTo.email}`, 300, billToY);
    billToY += 15;
  }

  // Move to line items section
  doc.y = Math.max(doc.y, startY + 100) + 20;

  // Line items table
  const tableTop = doc.y;
  const itemHeight = 30;
  let currentY = tableTop;

  // Table header
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Description', 50, currentY);
  doc.text('Qty', 300, currentY);
  doc.text('Unit Price', 350, currentY);
  doc.text('Total', 450, currentY);
  currentY += 20;

  // Draw header line
  doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
  currentY += 10;

  // Line items
  doc.fontSize(9).font('Helvetica');
  for (const item of invoice.lineItems) {
    if (currentY > 700) {
      // New page if needed
      doc.addPage();
      currentY = 50;
    }

    // Wrap description if too long
    const description = item.description.length > 40 ? item.description.substring(0, 37) + '...' : item.description;
    doc.text(description, 50, currentY, { width: 240 });
    doc.text(item.quantity.toString(), 300, currentY);
    doc.text(`${invoice.currency} ${item.unitPrice.toFixed(2)}`, 350, currentY);
    doc.text(`${invoice.currency} ${item.total.toFixed(2)}`, 450, currentY);

    // Tax info if applicable
    if (item.taxAmount && item.taxAmount > 0) {
      currentY += 15;
      doc.fontSize(8).font('Helvetica-Oblique');
      doc.text(`Tax (${item.taxRate || 0}%): ${invoice.currency} ${item.taxAmount.toFixed(2)}`, 60, currentY);
      doc.fontSize(9).font('Helvetica');
      currentY -= 15;
    }

    currentY += itemHeight;
  }

  // Totals section
  const totalsY = currentY + 20;
  doc.moveTo(350, totalsY).lineTo(550, totalsY).stroke();

  doc.fontSize(10).font('Helvetica');
  let totalY = totalsY + 10;

  // Subtotal
  doc.text('Subtotal:', 400, totalY, { align: 'right' });
  doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, 500, totalY, { align: 'right' });
  totalY += 20;

  // Discount
  if (invoice.discountAmount && invoice.discountAmount > 0) {
    doc.text('Discount:', 400, totalY, { align: 'right' });
    doc.text(`-${invoice.currency} ${invoice.discountAmount.toFixed(2)}`, 500, totalY, { align: 'right' });
    totalY += 20;
  }

  // Shipping
  if (invoice.shippingAmount && invoice.shippingAmount > 0) {
    doc.text('Shipping:', 400, totalY, { align: 'right' });
    doc.text(`${invoice.currency} ${invoice.shippingAmount.toFixed(2)}`, 500, totalY, { align: 'right' });
    totalY += 20;
  }

  // Tax breakdown
  if (invoice.taxAmount > 0) {
    if (invoice.taxType === 'gst' && invoice.taxBreakdown) {
      if (invoice.taxBreakdown.cgst) {
        doc.text('CGST:', 400, totalY, { align: 'right' });
        doc.text(`${invoice.currency} ${invoice.taxBreakdown.cgst.toFixed(2)}`, 500, totalY, { align: 'right' });
        totalY += 20;
      }
      if (invoice.taxBreakdown.sgst) {
        doc.text('SGST:', 400, totalY, { align: 'right' });
        doc.text(`${invoice.currency} ${invoice.taxBreakdown.sgst.toFixed(2)}`, 500, totalY, { align: 'right' });
        totalY += 20;
      }
      if (invoice.taxBreakdown.igst) {
        doc.text('IGST:', 400, totalY, { align: 'right' });
        doc.text(`${invoice.currency} ${invoice.taxBreakdown.igst.toFixed(2)}`, 500, totalY, { align: 'right' });
        totalY += 20;
      }
    } else if (invoice.taxType === 'vat' && invoice.taxBreakdown?.vat) {
      doc.text('VAT:', 400, totalY, { align: 'right' });
      doc.text(`${invoice.currency} ${invoice.taxBreakdown.vat.toFixed(2)}`, 500, totalY, { align: 'right' });
      totalY += 20;
    } else {
      doc.text(`Tax (${invoice.taxRate || 0}%):`, 400, totalY, { align: 'right' });
      doc.text(`${invoice.currency} ${invoice.taxAmount.toFixed(2)}`, 500, totalY, { align: 'right' });
      totalY += 20;
    }
  }

  // Total
  doc.moveTo(400, totalY).lineTo(550, totalY).stroke();
  totalY += 10;
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('Total:', 400, totalY, { align: 'right' });
  doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, 500, totalY, { align: 'right' });

  // Payment information
  totalY += 40;
  doc.fontSize(10).font('Helvetica');
  doc.text('Payment Information:', 50, totalY);
  totalY += 15;
  doc.text(`Payment Method: ${invoice.paymentMethod.toUpperCase()}`, 50, totalY);
  totalY += 15;
  doc.text(`Payment Status: ${invoice.paymentStatus.toUpperCase()}`, 50, totalY);
  totalY += 15;
  doc.text(`Order ID: ${invoice.orderId}`, 50, totalY);

  // Footer
  const footerY = 750;
  doc.fontSize(8).font('Helvetica-Oblique');
  doc.text(
    'This is a computer-generated invoice. No signature required.',
    50,
    footerY,
    { align: 'center', width: 500 }
  );
  doc.moveDown();
  doc.text(
    'Thank you for your business!',
    50,
    doc.y,
    { align: 'center', width: 500 }
  );

  // Finalize PDF
  doc.end();

  // Wait for stream to finish
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      resolve(pdfPath);
    });
    stream.on('error', reject);
  });
}

