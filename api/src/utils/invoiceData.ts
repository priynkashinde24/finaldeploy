import { IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';

/**
 * Invoice Data Structure Utility
 * 
 * PURPOSE:
 * - Generate invoice-ready tax data from orders
 * - Prepare structured payload for invoice generation (PDF generation in future)
 * - Ensure all tax information is auditable and complete
 * 
 * INVOICE FIELDS:
 * - Invoice number (from orderId)
 * - Seller GSTIN (future - to be added to Store/Admin settings)
 * - Buyer details (from order)
 * - Item list with tax breakdown
 * - Subtotal, tax total, grand total
 */

export interface InvoiceItem {
  productId: string;
  productName: string;
  variantId?: string | null;
  variantSku?: string | null;
  sku: string;
  quantity: number;
  unitRate: number; // Price per unit (after discounts, before tax)
  taxRate: number; // Tax rate percentage
  taxAmount: number; // Tax amount for this item
  totalAmount: number; // Total amount including tax for this item
  subtotal: number; // Amount before tax for this item
}

export interface InvoiceBuyer {
  name?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface InvoiceData {
  invoiceNumber: string; // Derived from orderId
  orderId: string;
  invoiceDate: Date;
  sellerGSTIN?: string; // Future: to be added to Store/Admin settings
  buyer: InvoiceBuyer;
  items: InvoiceItem[];
  subtotal: number; // Total before tax
  taxTotal: number; // Total tax amount
  shippingAmount: number;
  grandTotal: number; // Subtotal + tax + shipping
  taxType: 'gst' | 'vat' | null;
  currency: string; // Default: 'INR' for GST, 'USD' for others
}

/**
 * Generate invoice data from an order
 * 
 * NOTE: Order already contains snapshot tax values, so we use those
 * This ensures immutability - even if tax rates change later, invoice shows original values
 */
export async function generateInvoiceData(order: IOrder): Promise<InvoiceData> {
  // Generate invoice number from orderId
  const invoiceNumber = `INV-${order.orderId.replace('order_', '').toUpperCase()}`;

  // Prepare buyer information
  const buyer: InvoiceBuyer = {
    name: order.customerName || undefined,
    email: order.customerEmail || undefined,
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

  // Prepare items with tax breakdown
  const items: InvoiceItem[] = [];
  
  // Calculate tax per item (proportional distribution)
  const orderSubtotal = order.subtotal || order.finalAmount || 0;
  const orderTaxAmount = order.taxAmount || 0;
  const orderTaxRate = order.taxRate || 0;

  for (const item of order.items) {
    // Calculate item subtotal (after discounts)
    const itemSubtotal = item.totalPrice; // This is already after discounts

    // Calculate proportional tax for this item
    let itemTaxAmount = 0;
    if (orderSubtotal > 0 && orderTaxAmount > 0) {
      // Proportional tax distribution
      itemTaxAmount = (itemSubtotal / orderSubtotal) * orderTaxAmount;
      itemTaxAmount = Math.round(itemTaxAmount * 100) / 100;
    }

    // Get product details for variant info
    let variantSku: string | null = null;
    try {
      const product = await Product.findById(item.productId).lean();
      if (product) {
        // Try to find variant if SKU matches a variant
        const variant = await ProductVariant.findOne({
          productId: item.productId,
          sku: item.sku,
        }).lean();
        if (variant) {
          variantSku = variant.sku;
        }
      }
    } catch (error) {
      // If product lookup fails, continue without variant info
      console.warn(`Failed to lookup product ${item.productId} for invoice:`, error);
    }

    items.push({
      productId: item.productId,
      productName: item.name,
      variantId: null, // Not stored in order items currently
      variantSku: variantSku,
      sku: item.sku,
      quantity: item.quantity,
      unitRate: item.unitPrice, // Price per unit (after discounts, before tax)
      taxRate: orderTaxRate,
      taxAmount: itemTaxAmount,
      totalAmount: itemSubtotal + itemTaxAmount, // Item subtotal + tax
      subtotal: itemSubtotal,
    });
  }

  // Calculate totals
  const subtotal = orderSubtotal;
  const taxTotal = orderTaxAmount;
  const shippingAmount = order.shippingAmount || 0;
  const grandTotal = (order.totalAmountWithTax || subtotal + taxTotal + shippingAmount);

  // Determine currency based on tax type
  const currency = order.taxType === 'gst' ? 'INR' : order.taxType === 'vat' ? 'USD' : 'USD';

  return {
    invoiceNumber,
    orderId: order.orderId,
    invoiceDate: order.createdAt,
    sellerGSTIN: undefined, // TODO: Add to Store/Admin settings
    buyer,
    items,
    subtotal,
    taxTotal,
    shippingAmount,
    grandTotal,
    taxType: order.taxType || null,
    currency,
  };
}

/**
 * Format invoice data for API response
 */
export function formatInvoiceResponse(invoiceData: InvoiceData) {
  return {
    invoice: {
      invoiceNumber: invoiceData.invoiceNumber,
      orderId: invoiceData.orderId,
      invoiceDate: invoiceData.invoiceDate,
      seller: {
        gstin: invoiceData.sellerGSTIN,
        // TODO: Add seller name, address from Store/Admin settings
      },
      buyer: invoiceData.buyer,
      items: invoiceData.items.map((item) => ({
        product: {
          id: item.productId,
          name: item.productName,
          sku: item.sku,
          variantSku: item.variantSku,
        },
        quantity: item.quantity,
        rate: item.unitRate,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        subtotal: item.subtotal,
        total: item.totalAmount,
      })),
      summary: {
        subtotal: invoiceData.subtotal,
        taxTotal: invoiceData.taxTotal,
        shippingAmount: invoiceData.shippingAmount,
        grandTotal: invoiceData.grandTotal,
        taxType: invoiceData.taxType,
        currency: invoiceData.currency,
      },
    },
  };
}

