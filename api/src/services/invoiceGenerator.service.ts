import mongoose from 'mongoose';
import { IOrder } from '../models/Order';
import { PaymentSplit } from '../models/PaymentSplit';
import { Invoice, IInvoice, IInvoiceLineItem, IInvoiceBillingInfo } from '../models/Invoice';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { calculateTaxFromOrder } from '../utils/taxCalculator';
import { generateInvoicePdf } from './invoicePdf.service';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';
import { withTransaction } from '../utils/withTransaction';
import { Store } from '../models/Store';
import { User } from '../models/User';

/**
 * Invoice Generation Service
 * 
 * PURPOSE:
 * - Generate all invoices for an order (customer, supplier, reseller, platform)
 * - Integrate with PaymentSplit
 * - Generate PDFs
 * - Full audit trail
 * 
 * RULES:
 * - Never generate invoice before payment confirmation
 * - Totals must match PaymentSplit
 * - Tax snapshot frozen at generation time
 * - Idempotent (safe to retry)
 */

export interface GenerateInvoicesResult {
  success: boolean;
  invoices?: IInvoice[];
  error?: string;
}

/**
 * Get billing information for an entity
 */
async function getBillingInfo(
  entityType: 'customer' | 'supplier' | 'reseller' | 'platform',
  entityId: string,
  order: IOrder,
  storeId: mongoose.Types.ObjectId
): Promise<IInvoiceBillingInfo> {
  if (entityType === 'customer') {
    return {
      name: order.customerName || 'Customer',
      email: order.customerEmail,
      address: order.shippingAddress
        ? {
            street: order.shippingAddress.street,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            zip: order.shippingAddress.zip,
            country: order.shippingAddress.country,
          }
        : undefined,
    };
  }

  if (entityType === 'platform') {
    // Platform billing info (from store or default)
    const store = await Store.findById(storeId).lean();
    return {
      name: 'Platform',
      email: 'billing@platform.com', // TODO: Get from config
      address: {
        country: 'US', // TODO: Get from config
      },
    };
  }

  // Supplier or Reseller - get from User model
  try {
    const user = await User.findById(entityId).lean();
    if (user) {
      return {
        name: (user as any).name || (user as any).email || 'User',
        email: (user as any).email,
        taxId: (user as any).taxId || (user as any).gstin,
        phone: (user as any).phone,
      };
    }
  } catch (error) {
    console.warn(`Failed to get user info for ${entityType} ${entityId}:`, error);
  }

  // Fallback
  return {
    name: entityType === 'supplier' ? 'Supplier' : 'Reseller',
    email: undefined,
  };
}

/**
 * Generate line items for invoice
 */
function generateLineItems(
  invoiceType: 'customer' | 'supplier' | 'reseller' | 'platform',
  order: IOrder,
  split: any,
  taxCalculation: ReturnType<typeof calculateTaxFromOrder>
): IInvoiceLineItem[] {
  if (invoiceType === 'customer') {
    // Customer invoice: all order items
    return order.items.map((item) => {
      const itemSubtotal = item.totalPrice;
      const itemTaxAmount = (itemSubtotal / taxCalculation.subtotal) * taxCalculation.taxAmount;
      
      return {
        description: `${item.name} (SKU: ${item.sku})`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemSubtotal,
        taxRate: taxCalculation.taxRate,
        taxAmount: Math.round(itemTaxAmount * 100) / 100,
        taxType: taxCalculation.taxType,
      };
    });
  }

  // For supplier, reseller, platform - single line item
  let description: string;
  let amount: number;

  if (invoiceType === 'supplier') {
    description = `Supplier payment for order ${order.orderId}`;
    amount = split.supplierAmount;
  } else if (invoiceType === 'reseller') {
    description = `Reseller margin for order ${order.orderId}`;
    amount = split.resellerAmount;
  } else {
    description = `Platform commission for order ${order.orderId}`;
    amount = split.platformAmount;
  }

  // Calculate tax proportionally
  const taxProportion = amount / split.totalAmount;
  const taxAmount = taxCalculation.taxAmount * taxProportion;

  return [
    {
      description,
      quantity: 1,
      unitPrice: amount,
      total: amount,
      taxRate: taxCalculation.taxRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      taxType: taxCalculation.taxType,
    },
  ];
}

/**
 * Generate all invoices for an order
 * 
 * This function is idempotent - if invoices already exist, returns existing invoices
 */
export async function generateInvoices(orderId: string): Promise<GenerateInvoicesResult> {
  try {
    return await withTransaction(async (session) => {
      // STEP 1: Fetch Order
      const { Order } = await import('../models/Order');
      const order = await Order.findOne({ orderId }).session(session);

      if (!order) {
        return {
          success: false,
          error: `Order not found: ${orderId}`,
        };
      }

      // STEP 2: Validate payment confirmed
      if (order.status !== 'paid' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'cod_collected') {
        return {
          success: false,
          error: `Order payment not confirmed. Status: ${order.status}, Payment Status: ${order.paymentStatus}`,
        };
      }

      // STEP 3: Fetch PaymentSplit
      const split = await PaymentSplit.findOne({ orderId }).session(session);

      if (!split) {
        return {
          success: false,
          error: `Payment split not found for order ${orderId}. Invoice generation requires payment split.`,
        };
      }

      // STEP 4: Check if invoices already exist (idempotency)
      const existingInvoices = await Invoice.find({ orderId }).session(session);

      if (existingInvoices.length > 0) {
        console.log(`[INVOICE GENERATOR] Invoices already exist for order ${orderId}`);
        return {
          success: true,
          invoices: existingInvoices,
        };
      }

      // STEP 5: Calculate tax breakdown
      const taxCalculation = calculateTaxFromOrder(order);

      // STEP 6: Generate invoices
      const invoices: IInvoice[] = [];

      // 6a. Customer Invoice
      const customerInvoiceNumber = await generateInvoiceNumber(order.storeId);
      const customerBillingTo = await getBillingInfo('customer', order.customerEmail || '', order, order.storeId);
      const customerBillingFrom = await getBillingInfo('reseller', order.resellerId, order, order.storeId);

      const customerInvoice = new Invoice({
        storeId: order.storeId,
        orderId: order.orderId,
        invoiceNumber: customerInvoiceNumber,
        invoiceType: 'customer',
        entityId: order.customerEmail || order.orderId,
        paymentSplitId: split._id,
        billingTo: customerBillingTo,
        billingFrom: customerBillingFrom,
        lineItems: generateLineItems('customer', order, split, taxCalculation),
        subtotal: order.subtotal || order.totalAmount,
        discountAmount: order.discountAmount || 0,
        taxAmount: taxCalculation.taxAmount,
        shippingAmount: order.shippingAmount || 0,
        totalAmount: split.totalAmount,
        currency: order.taxType === 'gst' ? 'INR' : 'USD',
        taxType: taxCalculation.taxType,
        taxRate: taxCalculation.taxRate,
        taxBreakdown: taxCalculation.taxBreakdown,
        paymentMethod: order.paymentMethod || 'stripe',
        paymentStatus: order.paymentStatus === 'cod_collected' ? 'paid' : (order.paymentStatus || 'paid'),
        issuedAt: new Date(),
        status: 'issued',
      });

      await customerInvoice.save({ session });
      invoices.push(customerInvoice);

      // 6b. Supplier Invoice
      const supplierInvoiceNumber = await generateInvoiceNumber(order.storeId);
      const supplierBillingTo = await getBillingInfo('platform', 'platform', order, order.storeId);
      const supplierBillingFrom = await getBillingInfo('supplier', split.supplierId.toString(), order, order.storeId);

      const supplierInvoice = new Invoice({
        storeId: order.storeId,
        orderId: order.orderId,
        invoiceNumber: supplierInvoiceNumber,
        invoiceType: 'supplier',
        entityId: split.supplierId.toString(),
        paymentSplitId: split._id,
        billingTo: supplierBillingTo,
        billingFrom: supplierBillingFrom,
        lineItems: generateLineItems('supplier', order, split, taxCalculation),
        subtotal: split.supplierAmount,
        taxAmount: 0, // Supplier invoices typically don't include tax (B2B)
        totalAmount: split.supplierAmount,
        currency: 'USD',
        paymentMethod: order.paymentMethod || 'stripe',
        paymentStatus: 'paid',
        issuedAt: new Date(),
        status: 'issued',
      });

      await supplierInvoice.save({ session });
      invoices.push(supplierInvoice);

      // 6c. Reseller Invoice
      const resellerInvoiceNumber = await generateInvoiceNumber(order.storeId);
      const resellerBillingTo = await getBillingInfo('reseller', split.resellerId, order, order.storeId);
      const resellerBillingFrom = await getBillingInfo('platform', 'platform', order, order.storeId);

      const resellerInvoice = new Invoice({
        storeId: order.storeId,
        orderId: order.orderId,
        invoiceNumber: resellerInvoiceNumber,
        invoiceType: 'reseller',
        entityId: split.resellerId,
        paymentSplitId: split._id,
        billingTo: resellerBillingTo,
        billingFrom: resellerBillingFrom,
        lineItems: generateLineItems('reseller', order, split, taxCalculation),
        subtotal: split.resellerAmount,
        taxAmount: 0, // Reseller invoices typically don't include tax (B2B)
        totalAmount: split.resellerAmount,
        currency: 'USD',
        paymentMethod: order.paymentMethod || 'stripe',
        paymentStatus: 'paid',
        issuedAt: new Date(),
        status: 'issued',
      });

      await resellerInvoice.save({ session });
      invoices.push(resellerInvoice);

      // 6d. Platform Invoice
      const platformInvoiceNumber = await generateInvoiceNumber(order.storeId);
      const platformBillingTo = await getBillingInfo('platform', 'platform', order, order.storeId);
      const platformBillingFrom = await getBillingInfo('platform', 'platform', order, order.storeId);

      const platformInvoice = new Invoice({
        storeId: order.storeId,
        orderId: order.orderId,
        invoiceNumber: platformInvoiceNumber,
        invoiceType: 'platform',
        entityId: 'platform',
        paymentSplitId: split._id,
        billingTo: platformBillingTo,
        billingFrom: platformBillingFrom,
        lineItems: generateLineItems('platform', order, split, taxCalculation),
        subtotal: split.platformAmount,
        taxAmount: 0,
        totalAmount: split.platformAmount,
        currency: 'USD',
        paymentMethod: order.paymentMethod || 'stripe',
        paymentStatus: 'paid',
        issuedAt: new Date(),
        status: 'issued',
      });

      await platformInvoice.save({ session });
      invoices.push(platformInvoice);

      // STEP 7: Generate PDFs (async, non-blocking)
      for (const invoice of invoices) {
        try {
          const pdfPath = await generateInvoicePdf(invoice);
          invoice.pdfPath = pdfPath;
          // TODO: Upload to S3/Cloudinary and set pdfUrl
          // invoice.pdfUrl = await uploadToS3(pdfPath);
          await invoice.save({ session });
        } catch (error: any) {
          console.error(`[INVOICE GENERATOR] Failed to generate PDF for ${invoice.invoiceNumber}:`, error);
          // Don't fail the transaction, but log the error
        }
      }

      // STEP 8: Emit INVOICE_GENERATED event
      eventStreamEmitter.emit('event', {
        eventType: 'invoice.generated',
        payload: {
          orderId: order.orderId,
          storeId: order.storeId.toString(),
          invoiceCount: invoices.length,
          invoiceNumbers: invoices.map((inv) => inv.invoiceNumber),
        },
        storeId: order.storeId.toString(),
        userId: order.customerEmail || undefined,
        occurredAt: new Date(),
      });

      // STEP 9: Audit log
      await logAudit({
        storeId: order.storeId.toString(),
        actorRole: 'system',
        action: 'INVOICE_GENERATED',
        entityType: 'Invoice',
        description: `Invoices generated for order ${order.orderId}`,
        after: {
          orderId: order.orderId,
          invoiceCount: invoices.length,
          invoiceNumbers: invoices.map((inv) => inv.invoiceNumber),
        },
        metadata: {
          invoiceTypes: invoices.map((inv) => inv.invoiceType),
        },
      });

      return {
        success: true,
        invoices,
      };
    });
  } catch (error: any) {
    console.error(`[INVOICE GENERATOR] Error generating invoices for order ${orderId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to generate invoices',
    };
  }
}

