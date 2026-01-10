import { IOrder } from '../models/Order';
import { Store } from '../models/Store';
import { User } from '../models/User';

/**
 * SMS Template Variable Builder
 *
 * PURPOSE:
 * - Build template variables for different audiences
 * - Format values consistently
 * - Handle missing data gracefully
 *
 * RULES:
 * - All values must be strings
 * - No null/undefined values
 * - Format currency, dates, etc. consistently
 */

export interface TemplateVariables {
  [key: string]: string;
}

/**
 * Build variables for customer notifications
 */
export async function buildCustomerVariables(
  order: IOrder,
  store?: any,
  customer?: any
): Promise<TemplateVariables> {
  const variables: TemplateVariables = {
    name: customer?.name || order.customerName || 'Customer',
    orderNumber: order.orderNumber || order.orderId,
    amount: formatCurrency(order.grandTotal || order.totalAmountWithTax || 0),
  };

  // Add tracking link if available
  if (order.orderStatus === 'shipped' || order.orderStatus === 'out_for_delivery' || order.orderStatus === 'delivered') {
    const trackingLink = buildTrackingLink(order, store);
    if (trackingLink) {
      variables.trackingLink = trackingLink;
    }
  }

  // Add courier name if available
  if (order.courierSnapshot?.courierName) {
    variables.courierName = order.courierSnapshot.courierName;
  }

  // Add COD amount if applicable
  if (order.paymentMethod === 'cod' && order.codAmount) {
    variables.codAmount = formatCurrency(order.codAmount);
  }

  // Add refund amount if applicable
  if (order.metadata?.refundedAt && order.metadata?.refundAmount) {
    variables.refundAmount = formatCurrency(order.metadata.refundAmount);
  }

  return variables;
}

/**
 * Build variables for supplier notifications
 */
export async function buildSupplierVariables(
  order: IOrder,
  supplier?: any
): Promise<TemplateVariables> {
  const variables: TemplateVariables = {
    orderNumber: order.orderNumber || order.orderId,
    itemCount: (order.items?.length || 0).toString(),
  };

  // Add pickup address from fulfillment snapshot
  if (order.fulfillmentSnapshot?.items && order.fulfillmentSnapshot.items.length > 0) {
    const firstOrigin = order.fulfillmentSnapshot.items[0];
    if (firstOrigin.originAddress) {
      const addr = firstOrigin.originAddress;
      variables.pickupAddress = `${addr.name || ''}, ${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.pincode || ''}`.trim();
    }
  }

  return variables;
}

/**
 * Build variables for reseller notifications
 */
export async function buildResellerVariables(
  order: IOrder,
  reseller?: any
): Promise<TemplateVariables> {
  const variables: TemplateVariables = {
    orderNumber: order.orderNumber || order.orderId,
    amount: formatCurrency(order.grandTotal || order.totalAmountWithTax || 0),
  };

  // Calculate margin earned (reseller amount from payment split)
  // This would come from PaymentSplit or PayoutLedger
  // For now, use a placeholder or calculate from order items
  const marginEarned = calculateResellerMargin(order);
  if (marginEarned > 0) {
    variables.marginEarned = formatCurrency(marginEarned);
  }

  return variables;
}

/**
 * Build tracking link for order
 */
function buildTrackingLink(order: IOrder, store?: any): string | null {
  if (!order.orderNumber && !order.orderId) {
    return null;
  }

  const orderIdentifier = order.orderNumber || order.orderId;
  const baseUrl = process.env.FRONTEND_URL || 'https://store.example.com';
  return `${baseUrl}/track/${orderIdentifier}`;
}

/**
 * Format currency value
 */
function formatCurrency(amount: number): string {
  // Remove currency symbol for SMS (just show number)
  return new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate reseller margin (simplified)
 * In production, this should come from PaymentSplit
 */
function calculateResellerMargin(order: IOrder): number {
  // Simplified calculation: difference between selling price and supplier cost
  // In production, use actual PaymentSplit data
  let margin = 0;
  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const itemMargin = (item.unitPrice || 0) - (item.supplierCost || 0);
      margin += itemMargin * (item.quantity || 1);
    }
  }
  return Math.max(0, margin);
}

/**
 * Build variables based on role
 */
export async function buildTemplateVariables(
  order: IOrder,
  role: 'customer' | 'supplier' | 'reseller',
  store?: any,
  user?: any
): Promise<TemplateVariables> {
  switch (role) {
    case 'customer':
      return buildCustomerVariables(order, store, user);
    case 'supplier':
      return buildSupplierVariables(order, user);
    case 'reseller':
      return buildResellerVariables(order, user);
    default:
      return {};
  }
}

