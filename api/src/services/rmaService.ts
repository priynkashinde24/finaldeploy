import { Order } from '../models/Order';
import { Product } from '../models/Product';

export interface ReturnItem {
  productId: string;
  sku: string;
  quantity: number;
}

export interface ReturnFeeCalculation {
  totalFee: number;
  itemFees: Array<{
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    daysSincePurchase: number;
    baseFee: number;
    categorySurcharge: number;
    itemTotalFee: number;
  }>;
}

/**
 * Calculate days since purchase
 */
const getDaysSincePurchase = (orderDate: Date): number => {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - orderDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Calculate return fee based on rules
 * 
 * Rules:
 * - If daysSincePurchase > 30 ⇒ returnFee = 20% of product price
 * - If daysSincePurchase <= 7 ⇒ returnFee = 0
 * - If category in ["electronics"] ⇒ returnFee += 5% surcharge
 * 
 * @param orderId - Order ID
 * @param items - Items to return
 * @returns Return fee calculation breakdown
 */
export const calculateReturnFee = async (
  orderId: string,
  items: ReturnItem[]
): Promise<ReturnFeeCalculation> => {
  // Find order
  const order = await Order.findOne({ orderId });
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const orderDate = order.createdAt;
  const daysSincePurchase = getDaysSincePurchase(orderDate);

  const itemFees: ReturnFeeCalculation['itemFees'] = [];
  let totalFee = 0;

  // Process each return item
  for (const returnItem of items) {
    // Find the item in the order
    const orderItem = order.items.find((item) => item.productId === returnItem.productId);
    if (!orderItem) {
      throw new Error(`Product ${returnItem.productId} not found in order ${orderId}`);
    }

    // Validate quantity
    if (returnItem.quantity > orderItem.quantity) {
      throw new Error(
        `Return quantity (${returnItem.quantity}) exceeds ordered quantity (${orderItem.quantity})`
      );
    }

    // Get product details for category
    const product = await Product.findById(returnItem.productId);
    const category = product?.category?.toLowerCase() || '';

    // Calculate base fee based on days since purchase
    let baseFeePercent = 0;
    if (daysSincePurchase > 30) {
      baseFeePercent = 20; // 20% fee
    } else if (daysSincePurchase <= 7) {
      baseFeePercent = 0; // No fee within 7 days
    } else {
      // Between 8-30 days: 10% fee
      baseFeePercent = 10;
    }

    const baseFee = (orderItem.unitPrice * baseFeePercent) / 100;

    // Category surcharge
    let categorySurchargePercent = 0;
    if (category === 'electronics') {
      categorySurchargePercent = 5; // 5% surcharge for electronics
    }

    const categorySurcharge = (orderItem.unitPrice * categorySurchargePercent) / 100;

    // Calculate item total fee
    const itemUnitFee = baseFee + categorySurcharge;
    const itemTotalFee = itemUnitFee * returnItem.quantity;

    itemFees.push({
      productId: returnItem.productId,
      sku: returnItem.sku,
      quantity: returnItem.quantity,
      unitPrice: orderItem.unitPrice,
      daysSincePurchase,
      baseFee: itemUnitFee,
      categorySurcharge,
      itemTotalFee,
    });

    totalFee += itemTotalFee;
  }

  // Round to 2 decimal places
  totalFee = Math.round(totalFee * 100) / 100;
  itemFees.forEach((item) => {
    item.baseFee = Math.round(item.baseFee * 100) / 100;
    item.categorySurcharge = Math.round(item.categorySurcharge * 100) / 100;
    item.itemTotalFee = Math.round(item.itemTotalFee * 100) / 100;
  });

  return {
    totalFee,
    itemFees,
  };
};

/**
 * Add audit log entry to RMA
 */
export const addAuditLog = (
  rma: any,
  action: string,
  status: string,
  note?: string,
  userId?: string
): void => {
  if (!rma.auditLog) {
    rma.auditLog = [];
  }

  rma.auditLog.push({
    action,
    status,
    note,
    timestamp: new Date(),
    userId,
  });
};

